var currentImageIndex = 0;
var backgroundTimer;
var backgroundSliderInterval = 10000;

antjq(document).ready(function () {
    if (typeof window.parent.$ !== 'undefined') {
        window.parent.$('.desktop_title').html(antjq('.content-header').text());
    }

    if (antjq('button').data('lang-alignment') == 'right') {
        if (typeof window.parent.$ !== 'undefined') {
            window.parent.$('div, p, span').css({'unicode-bidi': 'embed', 'direction': 'rtl'});
        }
        antjq('div, p, span').css({'unicode-bidi': 'embed', 'direction': 'rtl'});
    } else {
        if (typeof window.parent.$ !== 'undefined') {
            window.parent.$('div, p, span').css({'unicode-bidi': '', 'direction': 'ltr'});
        }
        antjq('div, p, span').not('#background').css({'unicode-bidi': '', 'direction': 'ltr'});
    }

    enableSlidingBackground();

    if (antjq('.flexslider').length > 0) {
        antjq('.flexslider').flexslider({
            animation: "slide",
            // controlsContainer: ".flexslider",
            animationSpeed: 900,
            directionNav: false,
            controlNav: true,
            touch: true,
            animationDuration: 900,
            slideshowSpeed: 10000,
        });
    }

    if (antjq(".slides > li").length === 0) {
        antjq(".slider-holder").hide();
    } else {
        antjq(".slider-holder").show();
    }
});

function enableSlidingBackground() {

    antjq('.left-nav,.right-nav').off().on('click', function () {
        clearInterval(backgroundTimer);

        if (antjq(this).hasClass('.left-nav')) {
            prevBackgroundImage();
        } else {
            nextBackgroundImage();
        }

        backgroundTimer = setInterval(nextBackgroundImage, backgroundSliderInterval);
    });

    backgroundImages = [];
    mobileBackgroundImages = [];

    // process background images
    antjq('#background-images > li').each(function () {
        backgroundImages[backgroundImages.length] = antjq(this);
    });

    antjq('#mobile-background-images > li').each(function () {
        mobileBackgroundImages[mobileBackgroundImages.length] = antjq(this);
    });

    currentImageIndex = -1;
    setBackgroundImage();

    if (backgroundImages.length <= 1) {
        antjq('.left-nav,.right-nav').hide();
    }

    antjq(window).resize(function () {
        alignArrows();
        setBackgroundImage();
    });

    antjq(window.top).resize(function () {
        setBackgroundImage();
    });

    alignArrows();

}

function prevBackgroundImage() {
    if (window.self.innerWidth !== 0 && window.self.innerWidth > 600) {
        if (--currentImageIndex < 0) {
            currentImageIndex = backgroundImages.length - 1;
        }
        for (var i = 0; i < backgroundImages.length; i++) {
            backgroundImages[i].hide();
        }
        if (backgroundImages[currentImageIndex] != undefined) {
            backgroundImages[currentImageIndex].show();
        }
    } else {
        if (--currentImageIndex < 0) {
            currentImageIndex = mobileBackgroundImages.length - 1;
        }
        for (var i = 0; i < mobileBackgroundImages.length; i++) {
            mobileBackgroundImages[i].hide();
        }
        if (mobileBackgroundImages[currentImageIndex] != undefined) {
            mobileBackgroundImages[currentImageIndex].show();
        }
    }
}

function setBackgroundImage() {
    if (window.self.innerWidth !== 0 && window.self.innerWidth > 600) {
        antjq('#background-images').show();
        antjq('#mobile-background-images').hide();
    } else {
        antjq('#background-images').hide();
        antjq('#mobile-background-images').show();
    }
}

function nextBackgroundImage() {
    if (window.self.innerWidth !== 0 && window.self.innerWidth > 600) {
        if (++currentImageIndex >= backgroundImages.length) {
            currentImageIndex = 0;
        }

        for (var i = 0; i < backgroundImages.length; i++) {
            backgroundImages[i].hide();
        }

        if (backgroundImages[currentImageIndex] != undefined) {
            backgroundImages[currentImageIndex].show();
        }
    } else {
        if (++currentImageIndex >= mobileBackgroundImages.length) {
            currentImageIndex = 0;
        }
        for (var i = 0; i < mobileBackgroundImages.length; i++) {
            mobileBackgroundImages[i].hide();
        }
        if (mobileBackgroundImages[currentImageIndex] != undefined) {
            mobileBackgroundImages[currentImageIndex].show();
        }
    }
}

function alignArrows() {
    if (backgroundImages.length > 1 || mobileBackgroundImages.length > 1) {
        var leftNav = antjq('.left-nav');
        antjq(leftNav).css('left', '0');
        antjq(leftNav).css('top', '0');
        antjq(leftNav).width(60);
        antjq(leftNav).height(antjq(window).height());

        var rightNav = antjq('.right-nav');
        antjq(rightNav).css('right', '0');
        antjq(rightNav).css('top', '0');
        antjq(rightNav).width(60);
        antjq(rightNav).height(antjq(window).height());

        // if (backgroundTimer == null) {
        //     backgroundTimer = setInterval(nextBackgroundImage, backgroundSliderInterval);
        // }
    }
}
