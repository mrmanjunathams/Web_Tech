var express = require('express')
var app = express();
const http = require('http');
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

let sampleSchema2=new mongoose.Schema({

  auth:String,
  title:String,
  cate:String,
  date:String,
  img:String,
  blogp1:String,
  blogp2:String

});

let BAdd = mongoose.model("blog", sampleSchema2);
/*-------------------------------------------------------------------------------*/

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.use(session({secret:"manjunatha",resave:false,saveUninitialized:true,cookie:{maxage:6000}}));
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
console.log("server started at 3000");

console.log("done");

//11111111111111111111111111111111111111111111

  app.get("/BAdd",function(req,res){
  BAdd.find({},function(err,data){
    console.log(data);
    res.json(data);
  });
});

//!!!!!!!!!!!!!!!!!!!!session!!!!!!!!!!!!!!!!!!!!!!!!!

  app.get("/myacc",function(req,res){
  Sam1.findOne({username:"mrmanjunathams"},function(err,data){
    console.log(data);
    res.json(data);
  });
});

//@@@@@@@@@@@@@@@@add blog@@@@@@@@@@@@@@@@@@@@@@@@@@@@


app.get("/BAdd",function(req,res){
  BAdd.find({},function(err,data){
    console.log(data);
    res.json(data);
  });
});

app.post('/addblog',ue,function(req, res) {
  console.log(req.body);
  BAdd(req.body).save(function(err,data){
    res.json(data);
  });
});
app.listen(3020);
console.log("server started at 3020");

console.log("done"); 

/*Login for user-----------------------------------------------------------------------------*/
app.post('/loginuser',ue,function(req,res){
  

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



    req.session.username=req.body.username;
console.log("-----session inside-----");
     console.log(req.session);


    console.log('success');
    
    res.send({message:"successful login",
    username:req.body.username
  });
   
});

});


//Server Js

app.get("/blogs",function(req,res){
  res.writeHead(200,{"Content-Type":"application/json"})
  fs.createReadStream(__dirname+"/data1.json").pipe(res);

});
app.get("/cate",function(req,res){
  res.writeHead(200,{"Content-Type":"application/json"})
  fs.createReadStream(__dirname+"/data2.json").pipe(res);

});
app.listen(3050);



console.log("server staarted at 3050");


console.log("done");