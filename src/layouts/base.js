var burgerMenu = document.getElementById('burger-menu');

var overlay = document.querySelector('nav');

burgerMenu.addEventListener('click', function() {
  this.classList.toggle("close");
  overlay.classList.toggle("overlay");
});

console.log("test");