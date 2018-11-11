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
      controller: "catecontroller",
      templateUrl:"templets/cate.html"
    }).when("/writeblog",{
      templateUrl:"templets/write.html"
    });

});




app.controller("blogscontroller",function($scope,$http){                  //$scope is a application object
  $http.get("http://localhost:3050/blogs").then(function(response){
        $scope.data1=response.data;
        console.log(response.data);
      })
});
//###################!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!1

//json data jobs/////////////////////-------------------------------##################3
app.controller("catecontroller",function($scope,$http){
  $http.get("http://localhost:3050/cate").then(function(response){
        $scope.data2=response.data;
        console.log(response.data);
      })
});


var f = "../nodejs/data2.json";

writeTextFile(f, "Spoon");

function writeTextFile(afilename, output)
{
  var txtFile =new File(afilename);
  txtFile.writeln(output);
  txtFile.close();
}

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


