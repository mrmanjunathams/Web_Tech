var app =angular.module("myApp",["ngRoute"]);

app.config(function($routeProvider){
    $routeProvider.when("/",{
      templateUrl:"templets/home.html"
    }).when("/blog",{
        templateUrl:"templets/blog.html"
    }).when("/aboutme",{
        templateUrl:"templets/aboutme.html"
    }).when("/gallery",{
        templateUrl:"templets/gallery.html"
    }).when("/login",{
      templateUrl:"templets/login.html"
    }).when("/signup",{
      templateUrl:"templets/signup.html"
    }).when("/myacc",{
      templateUrl:"templets/myacc.html"
    }).when("/rewards",{
      templateUrl:"templets/timeline.html"
    });

});

app.controller("SignupController",function($scope,$http,$location){
  console.log("submit clicked");
$scope.submit=function(){
  let data={

  "email": $scope.email,
  "password": $scope.pass,
  "username": $scope.user
}
console.log(data);
$http.post("http://localhost:3001/adduser",data).then(function(response){
  console.log(response.data);
});


}
});