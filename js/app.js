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
      controller:"LoginController",
      templateUrl:"templets/login.html"
    }).when("/signup",{
      controller: "SignupController",
      templateUrl:"templets/signup.html"
    }).when("/myacc",{
      templateUrl:"templets/card.html"
    }).when("/rewards",{
      templateUrl:"templets/timeline.html"
    }).when("/pro",{
      templateUrl:"templets/card.html"
    }).when("/cate",{
      templateUrl:"templets/cate.html"
    }).when("/writeblog",{
      templateUrl:"templets/write.html"
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
//  $location.path('/employeeprofile?email=response.data.email');
  // $http.get("http://localhost:3000/employeeprofile?email="+$scope.email).then(function(response){
  //   $scope.datam=response.data;
  //   console.log("inside data fetcher");
  //   console.log($scope.datam);
  //
  //
  // });

  console.log("inside post")
  console.log(response.data);
  });
}
});