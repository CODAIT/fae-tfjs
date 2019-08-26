var picoConfig = {
    params: {
        "shiftfactor": 0.1, // move the detection window by 10% of its size
        "minsize": 100,     // minimum size of a face
        "maxsize": 1000,    // maximum size of a face
        "scalefactor": 1.1  // for multiscale processing: resize the detection window by 10% when moving to the higher scale
    },
    qThreshold: 100,    // (the constant 50.0 is empirical: other cascades might require a different one)
    facefinderClassifyRegionFunction: function (r, c, s, pixels, ldim) { return -1.0; }
}

var update_memory;
var initialized = false;
var ageEstimatorPromise;
var ageResults = new Array();
var detectedFaces = new Array();
// const tinyFaceOptions= new faceapi.TinyFaceDetectorOptions();

setup();

// Run setup
async function setup() {
    let button = document.getElementById("webcamButton");
    button.addEventListener("click", start)

    // Loads lightweight face detection
    update_memory = pico.instantiate_detection_memory(5); // we will use the detecions of the last 5 frames
    const cascadeurl = 'https://raw.githubusercontent.com/nenadmarkus/pico/c2e81f9d23cc11d1a612fd21e4f9de0921a5d0d9/rnt/cascades/facefinder';
    fetch(cascadeurl).then(function (response) {
        response.arrayBuffer().then(function (buffer) {
            var bytes = new Int8Array(buffer);
            picoConfig.facefinderClassifyRegionFunction = pico.unpack_cascade(bytes);
        })
    })

    // Loads heavy face detection algorithm from faceapi.js
    // const ssdMobileNet = await faceapi.loadSsdMobilenetv1Model('public/model/ssd_mobilenet');
    const tinyFace = await faceapi.loadTinyFaceDetectorModel('public/model/tiny_face');
}

/**
 *  Loads the face detector model and creates canvas to display webcam and model results.
 */
function start() {
    if (initialized)
        return;

    let myCanvas = document.getElementById("canvas");
    myCanvas.classList.toggle("hide");

    let button = document.getElementById("webcamButton");
    button.classList.add("hide");

    window.ctx = myCanvas.getContext('2d', {alpha: false});

    var mycamvas = new camvas(window.ctx, processFrame);
    initialized = true;
}

/**
 * Converts RGBA images to grayscale.
 * @param {Uint8ClampedArray} rgba      Underlying array of pixel data taken from the webcam.
 * @param {Number} nrows                Number of rows.
 * @param {Number} ncols                Number of columns.
 */
function rgba_to_grayscale(rgba, nrows, ncols) {
    var gray = new Uint8Array(nrows * ncols);
    for (var r = 0; r < nrows; ++r)
        for (var c = 0; c < ncols; ++c)
            // gray = 0.2*red + 0.7*green + 0.1*blue
            gray[r * ncols + c] = (2 * rgba[r * 4 * ncols + 4 * c + 0] + 7 * rgba[r * 4 * ncols + 4 * c + 1] + 1 * rgba[r * 4 * ncols + 4 * c + 2]) / 10;
    return gray;
}

/**
 * Runs the model on a single frame.
 * @param {Object} video                    Video object.
 * @param {Array} detectResult              Array containing results from face detection model.
 * @return {Promise}                        Returns a promise that returns a either an empty array or array of age predictions.
 */
async function runPrediction(video, detectResult) {
    let input = new Array()

    for (let i = 0; i < detectResult.length; i++) {
        let x = detectResult[i][0];
        let y = detectResult[i][1];
        let bbxwidth = detectResult[i][2];
        let bbxheight = detectResult[i][3];

        let cropImage = document.createElement('canvas')
        cropImage.width = bbxwidth
        cropImage.height = bbxheight
        let cropCtx = cropImage.getContext('2d')
        cropCtx.drawImage(video, x, y, bbxwidth, bbxheight, 0, 0, bbxwidth, bbxheight)
        input.push(cropImage)
    }

    // Inference
    if (input.length > 0) {
        return ageEstimator.predict(input)
    } else {
        return Promise.resolve([])
    }
}

/**
 * Takes in an array of bounding boxes and ages and updates the frame with the results.
 * @param {Array[Array[Number]]} faces          Array containing an array of numbers in the format [x, y, width, height]
 * @param {Array[Number]} ageResult             Array containing ages
 */
function processAgeResults(faces, ageResult) {
    for (i = 0; i < faces.length; i++) {
        let x = faces[i][0];
        let y = faces[i][1]
        window.ctx.lineWidth = 3
        window.ctx.strokeStyle = 'red'
        window.ctx.strokeRect(faces[i][0], faces[i][1], faces[i][2], faces[i][3]);
        window.ctx.font = '25px serif';
        window.ctx.fillStyle = 'lawngreen';
        window.ctx.fillText(Math.floor(ageResult[i]), faces[i][0], faces[i][1]);
    }
}

/**
 * Takes in a frame an uses the pico face detection library to return bounding boxes of faces in the image.
 * @param {ImageData} image
 * @returns {Array[Array[Number]]}              Returns an array containing an array of numbers in the format [x, y, width, height]
 */
function lightFaceDetection(image) {
    const rgba = image.data;
    const grayscaleImage = rgba_to_grayscale(rgba, 480, 640);

    // prepare input to `run_cascade`
    image = {
        "pixels": grayscaleImage,
        "nrows": 480,
        "ncols": 640,
        "ldim": 640
    }

    let detectedFaces = pico.run_cascade(image, picoConfig.facefinderClassifyRegionFunction, picoConfig.params);
    detectedFaces = update_memory(detectedFaces);
    detectedFaces = pico.cluster_detections(detectedFaces, 0.2); // set IoU threshold to 0.2

    /* Returns an array of the form (r, c, s, q) where
        r - row
        c - column
        s - size
        q - detection score
    */
    detectedFaces = detectedFaces
        .filter( det => {
            return (det[3] > picoConfig.qThreshold);
        })
        .map(det => {
            // Convert to format (x, y, width, height)
            let x = Math.floor(det[1] - det[2] / 2);
            let y = Math.floor(det[0] - det[2] / 2);
            let size = Math.floor(det[2]);
            return [x, y, size, size];
    })
    return detectedFaces;
}

/**
 * Takes in a frame and uses a Mobilenet model from faceapi.js to detect faces
 * @param {CanvasRenderingContext2D} image 
 * @returns {Promise}                       A promise containing an array of bounding boxes in the formart [x, y, width, height]
 */
async function heavyFaceDetection(image) {
    let result = faceapi.detectAllFaces(image, new faceapi.TinyFaceDetectorOptions()).then(
        faces => {
            let boundingBoxes = faces.map(face => {
                let box = face.box;
                return [box.x, box.y, box.width, box.height];
            })
            return boundingBoxes;
        }
    )
    return result;
}

/**
 * Runs every frame update. Grab the image from the webcam, run face detection, then crop
 * images for faces and send those images to the model.
 * @param {Object} video    Video object.
 * @param {Number} dt       Time elapsed between frames.
 */

async function processFrame(video, dt) {
    // stats.begin();
    const start = (new Date()).getTime();
    // render the video frame to the canvas element and extract RGBA pixel data
    window.ctx.drawImage(video, 0, 0);
    var image = window.ctx.getImageData(0, 0, 640, 480);

    // Run face detection
    let detectedFaces = lightFaceDetection(image);

    let faceDetectionTime = (new Date()).getTime() - start;

    if (!ageEstimatorPromise || !ageEstimatorPromise.isPending()) {
        ageEstimatorPromise = heavyFaceDetection(window.ctx.canvas)
            .then((faces) => detectedFaces = faces)
            .then(runPrediction(video, detectedFaces)
            .then((ages) => ageResults = ages)
        )
        ageEstimatorPromise = QuerablePromise(ageEstimatorPromise);
    }

    processAgeResults(detectedFaces, ageResults);
    let totalElapsedTime = (new Date()).getTime() - start;
    // document.getElementById("modelStats").innerHTML = `Detection time:  ${faceDetectionTime} ms<br>
    //                                                      Total time: ${totalElapsedTime}ms <br>
    //                                                      Backend is: ${tf.getBackend()}`;
    // stats.end();
}


/**
 * Wrapper for a Promise that adds functionality to check
 * current status of a promise.
 */
function QuerablePromise(promise) {

    var isPending = true;
    var result = promise.then(
        () => { isPending = false }
    )
    result.isPending = function () { return isPending }
    return result;
}