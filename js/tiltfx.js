/**
 * tiltfx.js
 * http://www.codrops.com
 *
 * Licensed under the MIT license.
 * http://www.opensource.org/licenses/mit-license.php
 * 
 * Copyright 2015, Codrops
 * http://www.codrops.com
 */
;(function(window) {
	
	'use strict';

	/**
	 * **************************************************************************
	 * utils
	 * **************************************************************************
	 */
	
	// from https://gist.github.com/desandro/1866474
	var lastTime = 0;
	var prefixes = 'webkit moz ms o'.split(' ');
	// get unprefixed rAF and cAF, if present
	var requestAnimationFrame = window.requestAnimationFrame;
	var cancelAnimationFrame = window.cancelAnimationFrame;
	// loop through vendor prefixes and get prefixed rAF and cAF
	var prefix;
	for( var i = 0; i < prefixes.length; i++ ) {
		if ( requestAnimationFrame && cancelAnimationFrame ) {
			break;
		}
		prefix = prefixes[i];
		requestAnimationFrame = requestAnimationFrame || window[ prefix + 'RequestAnimationFrame' ];
		cancelAnimationFrame  = cancelAnimationFrame  || window[ prefix + 'CancelAnimationFrame' ] ||
		window[ prefix + 'CancelRequestAnimationFrame' ];
	}

	// fallback to setTimeout and clearTimeout if either request/cancel is not supported
	if ( !requestAnimationFrame || !cancelAnimationFrame ) {
		requestAnimationFrame = function( callback, element ) {
			var currTime = new Date().getTime();
			var timeToCall = Math.max( 0, 16 - ( currTime - lastTime ) );
			var id = window.setTimeout( function() {
				callback( currTime + timeToCall );
			}, timeToCall );
			lastTime = currTime + timeToCall;
			return id;
		};

		cancelAnimationFrame = function( id ) {
			window.clearTimeout( id );
		};
	}

	function extend( a, b ) {
		for( var key in b ) { 
			if( b.hasOwnProperty( key ) ) {
				a[key] = b[key];
			}
		}
		return a;
	}

	// from http://www.quirksmode.org/js/events_properties.html#position
	function getMousePos(e) {
		var posx = 0;
		var posy = 0;
		if (!e) var e = window.event;
		if (e.pageX || e.pageY) 	{
			posx = e.pageX;
			posy = e.pageY;
		}
		else if (e.clientX || e.clientY) 	{
			posx = e.clientX + document.body.scrollLeft
				+ document.documentElement.scrollLeft;
			posy = e.clientY + document.body.scrollTop
				+ document.documentElement.scrollTop;
		}
		return {
			x : posx,
			y : posy
		}
	}

	// from http://www.sberry.me/articles/javascript-event-throttling-debouncing
	function throttle(fn, delay) {
		var allowSample = true;

		return function(e) {
			if (allowSample) {
				allowSample = false;
				setTimeout(function() { allowSample = true; }, delay);
				fn(e);
			}
		};
	}

	/***************************************************************************/

	/**
	 * TiltFx fn
	 * @param {HTMLElement} img element
	 * @param {object} options
	 */
	function TiltFx(el, options) {
		if(el) {
			this.el = el;
			this.options = extend( {}, this.options );
			extend( this.options, options );
			this._init();
			this._initEvents();
		}
	}

	/**
	 * TiltFx options.
	 */
	TiltFx.prototype.options = {
		// number of extra image elements (div with background-image) to add to the DOM - min:0, max:64 (for a higher number, it's recommended to remove the transitions of .tilt__front in the stylesheet.
		extraImgs : 2,
		// set scale factor - value what use to set scale gradients for each extra img
		extraImgsScaleGrade: 0,
		// the opacity value for all the image elements.
		opacity : 0.7,
		// when use set array of opacity for each image from bottom to top
		customImgsOpacity: false,
		// by default the first layer does not move.
		bgfixed : true,
		// use reset style for mouseleave event
		resetOnLeave: true,
		// image element's movement configuration
		movement : {
			perspective : 1000, // perspective value
			translateX : -10, // a relative movement of -10px to 10px on the x-axis (setting a negative value reverses the direction)
			translateY : -10, // a relative movement of -10px to 10px on the y-axis 
			translateZ : 20, // a relative movement of -20px to 20px on the z-axis (perspective value must be set). Also, this specific translation is done when the mouse moves vertically.
			rotateX : 2, // a relative rotation of -2deg to 2deg on the x-axis (perspective value must be set)
			rotateY : 2, // a relative rotation of -2deg to 2deg on the y-axis (perspective value must be set)
			rotateZ : 0 // z-axis rotation; by default there's no rotation on the z-axis (perspective value must be set)
		},
		// element for relative custom position offset
		element : {
			// element what will be bind to mousemove
			mouseMoveWatcher: null,
			// element for set bounds of mousemove
			viewWatcher: null
		}
	}

	/**
	 * Initialize: build the necessary structure for the image elements and replace it with the HTML img element.
	 */
	TiltFx.prototype._init = function() {
		this.tiltWrapper = document.createElement('div');
		this.tiltWrapper.className = 'tilt';

		// main image element.
		this.tiltImgBack = document.createElement('div');
		this.tiltImgBack.className = 'tilt__back';
		this.tiltImgBack.tiltFxType = 'back';
		this.tiltImgBack.style.backgroundImage = 'url(' + this.el.src + ')';
		this.tiltWrapper.appendChild(this.tiltImgBack);

		// image elements limit.
		if( this.options.extraImgs < 1 ) {
			this.imgCount = 0;
		}
		else if( this.options.extraImgs > 64 ) {
			this.imgCount = 64;
		}
		else {
			this.imgCount = this.options.extraImgs;
		}

		if( !this.options.movement.perspective ) {
			this.options.movement.perspective = 0;
		}

		// add the extra image elements.
		this.imgElems = [];
		var frontExtraImagesCount = this.imgCount;
		var customImgsOpacity = this.options.customImgsOpacity;

		if( !this.options.bgfixed ) {
			this.imgElems.push(this.tiltImgBack);
			++this.imgCount;
		}

		for(var i = 0; i < frontExtraImagesCount; ++i) {
			var el = document.createElement('div');
			el.className = 'tilt__front';
			el.style.backgroundImage = 'url(' + this.el.src + ')';
			this.tiltWrapper.appendChild(el);
			this.imgElems.push(el);
		}

		// set opacity for images
		this._initSetImagesOpacity();

		// add it to the DOM and remove original img element.
		this.el.parentNode.insertBefore(this.tiltWrapper, this.el);
		this.el.parentNode.removeChild(this.el);

		// set mosemove element area and view restrictions
		this._setViewWatcher(this);
		this._setMouseMoveWatcher(this);

		// viewWatcher properties: width/height/left/top
		this._calcView(this);
	};

	/**
	 * Set images opacity.
	 * @private
	 */
	TiltFx.prototype._initSetImagesOpacity = function() {
		if(this.options.customImgsOpacity) {
			for(var i = 0, len = this.imgElems.length; i < len; ++i) {
				var opacity = (this.options.customImgsOpacity[i])
					? this.options.customImgsOpacity[i]
					: this.options.opacity;

				this.imgElems[i].style.opacity = opacity;

			}

		}
		else {
			for(var i = 0, len = this.imgElems.length; i < len; ++i) {
				if(this.imgElems[i].tiltFxType === 'back') {
					continue;
				}

				this.imgElems[i].style.opacity = this.options.opacity;
			}

		}
	};

	TiltFx.prototype._calcView = function(self) {
		self.view = {
			width : self.viewWatcher.offsetWidth,
			height : self.viewWatcher.offsetHeight
		};
	};

	TiltFx.prototype._setMouseMoveWatcher = function(self) {
		var isSet = false;

		if(self.options.element && self.options.element.mouseMoveWatcher) {
			var mouseMoveWatcherElement = document.querySelector(self.options.element.mouseMoveWatcher);

			self.mouseMoveWatcher = mouseMoveWatcherElement;
			isSet = true;
		}

		if(!isSet) {
			self.mouseMoveWatcher = self.viewWatcher;
		}
	};

	TiltFx.prototype._setViewWatcher = function(self) {
		var isSet = false;

		if(self.options.element && self.options.element.viewWatcher) {
			var customElementRelative = document.querySelector(self.options.element.viewWatcher);

			if(customElementRelative) {
				self.viewWatcher = customElementRelative;
				isSet = true;
			}
		}

		if(!isSet) {
			self.viewWatcher = self.tiltWrapper;
		}
	};

	/**
	 * Initialize the events on the main wrapper.
	 */
	TiltFx.prototype._initEvents = function() {
		var self = this,
			moveOpts = self.options.movement;

		// mousemove event..
		self.mouseMoveWatcher.addEventListener('mousemove', function(ev) {
			requestAnimationFrame(function() {
					// mouse position relative to the document.
				var mousepos = getMousePos(ev),
					// document scrolls.
					docScrolls = {
						left : document.body.scrollLeft + document.documentElement.scrollLeft,
						top : document.body.scrollTop + document.documentElement.scrollTop
					},
					bounds = self.tiltWrapper.getBoundingClientRect(),
					// mouse position relative to the main element (tiltWrapper).
					relmousepos = {
						x : mousepos.x - bounds.left - docScrolls.left,
						y : mousepos.y - bounds.top - docScrolls.top
					};

				// configure the movement for each image element.
				for(var i = 0, len = self.imgElems.length; i < len; ++i) {
					var el = self.imgElems[i],
						rotX = moveOpts.rotateX ? 2 * ((i+1)*moveOpts.rotateX/self.imgCount) / self.view.height * relmousepos.y - ((i+1)*moveOpts.rotateX/self.imgCount) : 0,
						rotY = moveOpts.rotateY ? 2 * ((i+1)*moveOpts.rotateY/self.imgCount) / self.view.width * relmousepos.x - ((i+1)*moveOpts.rotateY/self.imgCount) : 0,
						rotZ = moveOpts.rotateZ ? 2 * ((i+1)*moveOpts.rotateZ/self.imgCount) / self.view.width * relmousepos.x - ((i+1)*moveOpts.rotateZ/self.imgCount) : 0,
						transX = moveOpts.translateX ? 2 * ((i+1)*moveOpts.translateX/self.imgCount) / self.view.width * relmousepos.x - ((i+1)*moveOpts.translateX/self.imgCount) : 0,
						transY = moveOpts.translateY ? 2 * ((i+1)*moveOpts.translateY/self.imgCount) / self.view.height * relmousepos.y - ((i+1)*moveOpts.translateY/self.imgCount) : 0,
						transZ = moveOpts.translateZ ? 2 * ((i+1)*moveOpts.translateZ/self.imgCount) / self.view.height * relmousepos.y - ((i+1)*moveOpts.translateZ/self.imgCount) : 0,

						scale = 1 + (self.options.extraImgsScaleGrade * (len - (i+1))),
						scaleCss = (scale !== 1) ? ' scale(' + scale + ', ' + scale + ')' : '';

					el.style.WebkitTransform =
						'perspective(' + moveOpts.perspective + 'px)' +
						' translate3d(' + transX + 'px,' + transY + 'px,' + transZ + 'px)' +
						' rotate3d(1,0,0,' + rotX + 'deg)' +
						' rotate3d(0,1,0,' + rotY + 'deg)' +
						' rotate3d(0,0,1,' + rotZ + 'deg)' +
						scaleCss;

					el.style.transform =
						'perspective(' + moveOpts.perspective + 'px)' +
						' translate3d(' + transX + 'px,' + transY + 'px,' + transZ + 'px)' +
						' rotate3d(1,0,0,' + rotX + 'deg)' +
						' rotate3d(0,1,0,' + rotY + 'deg)' +
						' rotate3d(0,0,1,' + rotZ + 'deg)' +
						scaleCss;
				}
			});
		});

		// reset all when mouse leaves the main wrapper.
		if(self.options.resetOnLeave) {
			self.mouseMoveWatcher.addEventListener('mouseleave', function () {
				setTimeout(function () {
					for (var i = 0, len = self.imgElems.length; i < len; ++i) {
						var el = self.imgElems[i];
						el.style.WebkitTransform = 'perspective(' + moveOpts.perspective + 'px) translate3d(0,0,0) rotate3d(1,1,1,0deg)';
						el.style.transform = 'perspective(' + moveOpts.perspective + 'px) translate3d(0,0,0) rotate3d(1,1,1,0deg)';
					}
				}, 60);

			});
		}

		// window resize
		window.addEventListener('resize', throttle(function() {
			// recalculate viewWatcher properties: width/height/left/top
			self._calcView(self);
		}, 50));
	};

	/**
	 * Init tiltFx on each imgs with the class "tilt-effect"
	 */
	TiltFx.prototype.init = function() {
		// search for imgs with the class "tilt-effect"
		[].slice.call(document.querySelectorAll('img.tilt-effect')).forEach(function(img) {
			new TiltFx(img, JSON.parse(img.getAttribute('data-tilt-options')));
		});
	};

	(new TiltFx()).init();

	window.TiltFx = TiltFx;

})(window);
