var express = require('express')
var app = express();
var fs=require('fs');
var bodyParser = require('body-parser');
var mongoose=require('mongoose');
var session=require('express-session');
let ue=bodyParser.json();
var nodemailer = require('nodemailer');



mongoose.connect("mongodb://TravelCity:manjunatha9598@ds125322.mlab.com:25322/travelcity");
/* Register collection  for employeesss*/
let sampleSchema=new mongoose.Schema({

  email:String,
  password:String,
  username:String

});
let Sam1 = mongoose.model("register", sampleSchema);
/*-------------------------------------------------------------------------------*/

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


/*Display on console of Register insert documentssss For employeess--------------------------------*/
app.get("/Sam1",function(req,res){
  Sam1.find({},function(err,data){
    console.log(data);
    res.json(data);
  });
});

app.post('/addemp',ue,function(req, res) {
  console.log(req.body);
  Sam1(req.body).save(function(err,data){
    res.json(data);
  });
});
app.listen(3001);
console.log("server started");

console.log("done");
