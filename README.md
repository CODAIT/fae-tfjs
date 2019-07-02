# IBM Code Model Asset Exchange: Facial Age Estimator with TensorFlow.js

You can run this demo app in your local environment if you have Node.js or Docker installed.

## Run in Node.js

If you have [Node.js](https://nodejs.org/en/download/) installed:

1. Clone this repository

   ```
   $ git clone https://github.com/IBM/fae-tfjs
   $ cd fae-tfjs
   ```

2. Install dependencies

   ```
   $ npm install
   ```

3. Run app

   ```
   $ node app.js
   ```

4. In your browser, visit [localhost:3000](http://localhost:3000).


## Run in Docker image

If you have [Docker](https://www.docker.com/products/docker-desktop) installed:

1. Clone this repository

   ```
   $ git clone https://github.com/IBM/fae-tfjs
   $ cd fae-tfjs
   ```

2. [Build the Docker image](https://docs.docker.com/engine/reference/commandline/build/)

   ```
   $ docker build -t fae-tfjs .
   ```

3. [Run the Docker container](https://docs.docker.com/engine/reference/commandline/run/)

   ```
   $ docker run -it -p 3000:3000 fae-tfjs
   ``` 

4. In your browser, open [localhost:3000](http://localhost:3000) and enable the web camera

5. [Obtain the container id](https://docs.docker.com/engine/reference/commandline/ps/) and [stop the Docker container](https://docs.docker.com/engine/reference/commandline/stop/)

   ```
   $ docker ps 
    CONTAINER ID        IMAGE               COMMAND                  ...
    3...6              fae-tfjs             ...
   $ docker stop 3...6  
   ```
