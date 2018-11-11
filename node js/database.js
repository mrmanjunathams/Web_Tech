var express = require('express')
var app = express();
var fs=require('fs');
var bodyParser = require('body-parser');
var mongoose=require('mongoose');
var session=require('express-session');
let ue=bodyParser.json();
var nodemailer = require('nodemailer');



mongoose.connect("mongodb://bloggerbytes:manjunatha9598@ds157923.mlab.com:57923/bloggerbytes");
/* Register collection  for employeesss*/
let sampleSchema=new mongoose.Schema({

  username:String,
  email:String,
  password:String

});
let Sam1 = mongoose.model("user", sampleSchema);
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

app.post('/adduser',ue,function(req, res) {
  console.log(req.body);
  Sam1(req.body).save(function(err,data){
    res.json(data);
  });
});
app.listen(3000);
console.log("server started");

console.log("done");



/*Login for user-----------------------------------------------------------------------------*/
app.post('/loginuser',ue,function(req,res){
  //console.log(req.body.email);

var username=req.body.username;
  var password=req.body.password;
  Sam1.findOne({username:username,password:password},function(err,data){
    if(err){
      console.log(err);
     return res.status(500).send();
    console.log('error');
    }
    if(!data){
      return res.status(404).send();
      console.log('fail1');
    }
    // var name="email";
    // var value=req.body.email;
     //req.session[name]=value;
     
    // console.log("insidelogin session"+req.session.email);

    //return res.status(200).send();
  //  req.session.email=email;
    console.log('success');
    res.send({message:"successful login",
    username:req.body.username
  });
    //res.json(data);
});
//console.log(req.session);
//console.log("session "+req.session.email);
});