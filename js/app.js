var app =angular.module("myApp",["ngRoute"]);
app.config(function($routeProvider){
    $routeProvider.when("/",{
      templateUrl:"templets/home.html"
    }).when("/blog",{
        controller:"blogscontroller",
        templateUrl:"templets/blog.html"
    }).when("/aboutme",{
        templateUrl:"templets/aboutme.html"
    }).when("/gallery",{
        templateUrl:"templets/gallery.html"
    }).when("/login",{
      controller:"LoginController",
      templateUrl:"templets/login.html"
    }).when("/signup",{
      controller: "SignupController",
      templateUrl:"templets/signup.html"
    }).when("/myacc",{
      controller:"myacccontroller",
      templateUrl:"templets/card.html"
    }).when("/rewards",{
      templateUrl:"templets/timeline.html"
    }).when("/cate",{
      controller: "catecontroller",
      templateUrl:"templets/cate.html"
    }).when("/writeblog",{
      controller:"WBController",
      templateUrl:"templets/write.html"
    });

});

//-----------------------------session--------------------------

app.controller("myacccontroller",function($scope,$http){                  //$scope is a application object
  $http.get("http://localhost:3050/myacc").then(function(response){
        $scope.datam=response.data;
        console.log(response.data);
      })
});

//+++++++++++++++++++blog======================

app.controller("blogscontroller",function($scope,$http){                  //$scope is a application object
  $http.get("http://localhost:3050/blogs").then(function(response){
        $scope.data1=response.data;
        console.log(response.data);
      })
});
//###################!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!1

//json data jobs/////////////////////-------------------------------##################3
app.controller("catecontroller",function($scope,$http){
  $http.get("http://localhost:3050/BAdd").then(function(response){
        $scope.data2=response.data;
        console.log(response.data);
      })
});

app.controller("SignupController",function($scope,$http,$location){
  console.log("submit clicked");
$scope.submit=function(){
  let data={
  "username" : $scope.username,
  "email": $scope.email,
  "password": $scope.password
}
console.log(data);
$http.post("http://localhost:3000/adduser",data).then(function(response){
  console.log(response.data);
  $location.path('/myacc');
});


}
});


app.controller("WBController",function($scope,$http,$location){
  console.log("submit clicked");
$scope.submit=function(){
  let data={
  "auth" : $scope.auth,
  "title": $scope.titl,
  "cate": $scope.cate,
  "date": $scope.date,
  "img": $scope.img,
  "blogp1": $scope.blogp1,
  "blogp2": $scope.blogp2
}
console.log(data);
$http.post("http://localhost:3020/addblog",data).then(function(response){
  console.log(response.data);
  $location.path('/myacc');
});


}
});


app.controller("LoginController",function($scope,$http,$location){
  console.log("submit clicked");
$scope.submit=function(){
  let data={
  "username": $scope.username,
  "password": $scope.password
  }
console.log(data);
$http.post("http://localhost:3000/loginuser",data).then(function(response){
  console.log(response.data);
  console.log(response.data.username);
  $location.path('/myacc');


  console.log("inside post")
  console.log(response.data);
  });

}
});


