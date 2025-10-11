var burgerMenu = document.getElementById('burger-menu');
var navClose = document.getElementById('nav-close');
var overlay = document.querySelector('nav');

function toggleMenu() {
  burgerMenu.classList.toggle("close");
  overlay.classList.toggle("overlay");
  navClose.classList.toggle("visible");
}

navClose.addEventListener('click', toggleMenu);
burgerMenu.addEventListener('click', toggleMenu);
