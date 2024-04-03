$(".congrats-slider").slick({
  dots: true,
  infinite: true,
  speed: 300,
  slidesToShow: 1,
  adaptiveHeight: true,
  arrows: false,
});

const img = document.querySelector("#img-change");
const select = document.querySelector("#country");
let url = window.location.origin;
console.log(url);

select.addEventListener("change", function () {
  img.src = `${url}/assets/images/airport-hq/${this.selectedOptions[0].dataset.countrycode.toLowerCase()}.jpg`;
});
