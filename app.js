const express = require("express");
const app = express();

app.set('views', __dirname + '/views');
app.use("/public", express.static(__dirname + '/public'));
app.use("/model", express.static(__dirname + '/model'));

app.engine('html', require('ejs').renderFile);
app.set('view engine', 'ejs');

app.get('/', function(req, res) {
    res.render('index.html');
});

app.listen(3000, "localhost", function(){
    console.log("Server running at port 3000");
})