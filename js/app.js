var app =angular.module("myApp",["ngRoute"]);

app.config(function($routeProvider){
    $routeProvider.when("/",{
      templateUrl:"templets/home2.html"
    }).when("/blog",{
        templateUrl:"templets/blog.html"
    }).when("/aboutme",{
        templateUrl:"templets/aboutme.html"
    }).when("/gallery",{
        templateUrl:"templets/gallery.html"
    }).when("/login",{
      templateUrl:"templets/login.html"
    }).when("/signup",{
      controller: "SignupController",
      templateUrl:"templets/signup.html"
    }).when("/myacc",{
      templateUrl:"templets/myacc.html"
    }).when("/rewards",{
      templateUrl:"templets/timeline.html"
    }).when("/pro",{
      templateUrl:"templets/card.html"
    }).when("/cate",{
      templateUrl:"templets/cate.html"
    });

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
});


}
});