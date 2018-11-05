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
    }).when("/travel",{
      templateUrl:"templets/travel.html"
    }).when("/lifestyle",{
      templateUrl:"templets/lifestyle.html"
    }).when("/myacc",{
      templateUrl:"templets/myacc.html"
    }).when("/rewards",{
      templateUrl:"templets/timeline.html"
    });

});
