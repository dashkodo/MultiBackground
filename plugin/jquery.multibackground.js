/*!
 * MultiBackground v1.1.7
 *  - http://multibackground.tonybogdanov.com
 *  - https://github.com/TonyBogdanov/MultiBackground
 *
 * Contributors:
 *  - http://www.tonybogdanov.com
 *
 * You may use this plugin in personal or commercial projects.
 * You can modify and redistribute it freely.
 * You can include it in any packages or projects being sold, but you cannot charge for the plugin or sell it separately.
 * Attribution is appreciated, but not required :)
 */
// API lifecycle flags
var mb_YouTubeAPIReady = false, mb_GoogleMapsAPIReady = false;
function onYouTubePlayerAPIReady() {
    mb_YouTubeAPIReady = true;
}
function onGoogleMapsAPIReady() {
    mb_GoogleMapsAPIReady = true;
}

// Plugin
(function($) {
    "use strict";

    // Main plugin definition
    // Accepts a single options object or an array of option objects (if one wants to create multiple background layers) as first argument.
    // Accepts a boolean, true (default) if the plugin should run in silent mode, e.g. all errors should be only logged in the console log, or false if all errors should be "alert"-ed to the browser, as second argument.
    // NOTE: This function set "position: relative" to the parent element(s), to which it is applied and will prepend all background layer elements before any content. Call {action: destroy} to restore the element.
    // TODO Unit tests
    $.fn.multiBackground = function(options, silent) {
        try {
            return $(this).each(function() {
                // Reference to the parent element
                var $this = $(this);

                // Test type of options variable
                switch(true) {
                    // If the param is an array, walk each element and call the plugin for it (this will, in the default case, create multiple layers)
                    case "object" === typeof options && "[object Array]" === Object.prototype.toString.call(options):
                        if(0 === options.length) {
                            throw "First argument cannot be an empty array";
                        }
                        for(var key in options) {
                            $this.multiBackground(options[key], silent);
                        }
                        return $this;

                    // If the param is an object, continue algorithm
                    case "object" === typeof options:
                        break;

                    // If nothing matched up till here, the argument is not supported
                    default:
                        throw "Unsupported type of first argument: \"" + typeof options + "\"";
                }

                // Extend default plugin options with passed
                options = $.extend(true, {}, $.fn.multiBackground._defaultOptions, options);

                // Slideshow
                if(
                    'undefined' != typeof $this.attr('data-multibackground-slideshow-direction') &&
                    'undefined' == typeof $this.data('mb-slideshow')
                ) {
                    $this.data('mb-slideshow', new MultiBackgroundSlideshow($this));
                }

                // Check action
                if("string" !== typeof options["action"]) {
                    throw "Plugin options must specify a \"action\" param with a value of type \"string\"";
                }
                switch(options["action"]) {
                    // Prepend layer (put under all other)
                    case "prepend":
                        // Prepare parent
                        if(true !== $this.data("mb-prepared")) {
                            $this.data("mb-prepared", true);
                            $this.data("mb-original-position", $this.css("position"));
                            $this.css("position", "relative");
                        }

                        // Create layer element
                        var $element = $.fn.multiBackground._createLayer(options);

                        // Put as first layer
                        var $layers = $this.find("> [data-multibackground-layer]");
                        if(0 === $layers.length) {
                            $this.wrapInner("<div data-multibackground-content style=\"position: relative;\"/>");
                        }
                        $element.attr("data-multibackground-layer", 0);
                        $this.prepend($element);
                        if(0 < $layers.length) {
                            $layers.each(function(i) {
                                $(this).attr("data-multibackground-layer", i + 1);
                            });
                        }

                        // Add layer to slideshow
                        if($this[0].hasAttribute('data-multibackground-slideshow-direction')) {
                            $this.data("mb-slideshow").prepend($element, options);
                        }

                        // Loader
                        $.fn.multiBackground._loader($this);
                        break;

                    // Append layer (put above all other)
                    case "append":
                        // Prepare parent
                        if(true !== $this.data("mb-prepared")) {
                            $this.data("mb-prepared", true);
                            $this.data("mb-original-position", $this.css("position"));
                            $this.css("position", "relative");
                        }

                        // Create layer element
                        var $element = $.fn.multiBackground._createLayer(options);

                        // Find last layer in parent and push after it, or put as first layer
                        var $layers = $this.find("> [data-multibackground-layer]");
                        if(0 === $layers.length) {
                            $this.wrapInner("<div data-multibackground-content style=\"position: relative;\"/>");
                            $element.attr("data-multibackground-layer", 0);
                            $this.prepend($element);
                        } else {
                            $element.attr("data-multibackground-layer", $layers.length);
                            $layers.last().after($element);
                        }

                        // Add layer to slideshow
                        if($this[0].hasAttribute('data-multibackground-slideshow-direction')) {
                            $this.data("mb-slideshow").append($element, options);
                        }

                        // Loader
                        $.fn.multiBackground._loader($this);
                        break;

                    // Remove layer by index
                    case "remove":
                        // Get layer index
                        var index = parseInt(options["index"]);
                        if(isNaN(index)) {
                            throw "Plugin options must specify a \"index\" param with a value of type \"integer\"";
                        }

                        // Find layer by the given index, deregister callbacks and remove it from DOM
                        var $layer = $this.find("> [data-multibackground-layer=\"" + index + "\"]");
                        if(0 === $layer.length) {
                            throw "There is no MultiBackground layer for index: " + index;
                        }
                        if("function" === typeof $layer.data("mb-refresh")) {
                            $.fn.multiBackground._refreshEvents.remove($layer.data("mb-refresh"));
                        }
                        $layer.remove();

                        // Reindex remaining layers
                        $this.find("> [data-multibackground-layer]").each(function(i) {
                            $(this).attr("data-multibackground-layer", i);
                        });
                        break;

                    // Destroy MultiBackground structure and restore original schema
                    case "destroy":
                        // Deregister all layer callbacks & remove layers
                        $this.find("> [data-multibackground-layer]").each(function() {
                            if("function" === typeof $(this).data("mb-refresh")) {
                                $.fn.multiBackground._refreshEvents.remove($(this).data("mb-refresh"));
                            }
                            $(this).remove();
                        });

                        // Unregister slideshow
                        if("undefined" !== typeof $this.data("mb-slideshow")) {
                            $this.data("mb-slideshow").destroy();
                        }
                        
                        // Remove loader
                        $this.find(".mb-s").remove();

                        // Unwrap content
                        var $content    = $this.find("> [data-multibackground-content]");
                        if(0 < $content.contents().length) {
                            $content.contents().unwrap();
                        } else {
                            $content.remove();
                        }

                        // Restore parent
                        $this.css("position", $this.data("mb-original-position"));
                        $this.removeAttr("data-multibackground-content");
                        $this.removeData("mb-prepared");
                        break;

                    // Start video playback
                    case "playVideo":
                        // Get layer index
                        var index = parseInt(options["index"]);
                        if(isNaN(index)) {
                            throw "Plugin options must specify a \"index\" param with a value of type \"integer\"";
                        }

                        // Find layer by the given index and signal attached player
                        var $layer = $this.find("> [data-multibackground-layer=\"" + index + "\"]");
                        $layer.data("mb-video-player").play();
                        break;

                    // Pause video playback
                    case "pauseVideo":
                        // Get layer index
                        var index = parseInt(options["index"]);
                        if(isNaN(index)) {
                            throw "Plugin options must specify a \"index\" param with a value of type \"integer\"";
                        }

                        // Find layer by the given index and signal attached player
                        var $layer = $this.find("> [data-multibackground-layer=\"" + index + "\"]");
                        $layer.data("mb-video-player").pause();
                        break;

                    // Stop video playback
                    case "stopVideo":
                        // Get layer index
                        var index = parseInt(options["index"]);
                        if(isNaN(index)) {
                            throw "Plugin options must specify a \"index\" param with a value of type \"integer\"";
                        }

                        // Find layer by the given index and signal attached player
                        var $layer = $this.find("> [data-multibackground-layer=\"" + index + "\"]");
                        $layer.data("mb-video-player").stop();
                        break;

                    // Mute video playback
                    case "muteVideo":
                        // Get layer index
                        var index = parseInt(options["index"]);
                        if(isNaN(index)) {
                            throw "Plugin options must specify a \"index\" param with a value of type \"integer\"";
                        }

                        // Find layer by the given index and signal attached player
                        var $layer = $this.find("> [data-multibackground-layer=\"" + index + "\"]");
                        $layer.data("mb-video-player").mute();
                        break;

                    // Unmute video playback
                    case "unMuteVideo":
                        // Get layer index
                        var index = parseInt(options["index"]);
                        if(isNaN(index)) {
                            throw "Plugin options must specify a \"index\" param with a value of type \"integer\"";
                        }

                        // Find layer by the given index and signal attached player
                        var $layer = $this.find("> [data-multibackground-layer=\"" + index + "\"]");
                        $layer.data("mb-video-player").unMute();
                        break;

                    // Start slideshow playback
                    case "startSlideshow":
                        if("undefined" !== typeof $this.data("mb-slideshow")) {
                            $this.data("mb-slideshow").start();
                        }
                        break;

                    // Stop slideshow playback
                    case "stopSlideshow":
                        if("undefined" !== typeof $this.data("mb-slideshow")) {
                            $this.data("mb-slideshow").stop();
                        }
                        break;

                    // Pause slideshow playback
                    case "pauseSlideshow":
                        if("undefined" !== typeof $this.data("mb-slideshow")) {
                            $this.data("mb-slideshow").pause();
                        }
                        break;

                    // Resume slideshow playback
                    case "resumeSlideshow":
                        if("undefined" !== typeof $this.data("mb-slideshow")) {
                            $this.data("mb-slideshow").resume();
                        }
                        break;

                    // Play next slide
                    case "nextSlideshow":
                        if("undefined" !== typeof $this.data("mb-slideshow")) {
                            $this.data("mb-slideshow").next(options['callback']);
                        }
                        break;

                    // Play prev slide
                    case "prevSlideshow":
                        if("undefined" !== typeof $this.data("mb-slideshow")) {
                            $this.data("mb-slideshow").prev(options['callback']);
                        }
                        break;

                    // Unsupported action
                    default:
                        throw "Unsupported action: \"" + options["action"] + "\"";
                }
            });
        } catch(e) {
            if(false === silent) {
                alert("MBERROR: " + e);
            }
            console.log("MBERROR: " + e);
            console.trace();
        }
    };

    // Initialize the plugin using values extracted from the HTML attributes of the element
    // TODO Unit tests
    $.fn.multiBackgroundFromAttributes = function() {
        return $(this).each(function() {
            var $this   = $(this);
            var debug   = "debug" === $this.attr("data-multibackground");
            try {
                var options = $.fn.multiBackground._extractOptions($this);
                $this.multiBackground(options, !debug);
            } catch(e) {
                if(debug) {
                    alert("MBERROR: " + e);
                }
                console.log("MBERROR: " + e);
                console.trace();
            }
        });
    };

    // Initialize the plugin using values extracted from the HTML attributes of an integrator element
    // TODO Unit tests
    $.fn.multiBackgroundFromIntegrator = function() {
        return $(this).each(function() {
            var $this   = $(this);
            var debug   = "debug" === $this.attr("data-multibackground-integrator");
            try {
                var selector    = $this.attr("data-multibackground-integrator-selector");
                var options     = $.parseJSON($this.attr("data-multibackground-integrator-options"));
                $(selector).multiBackground(options, !debug);
            } catch(e) {
                if(debug) {
                    alert("MBERROR: " + e);
                }
                console.log("MBERROR: " + e);
                console.trace();
            }
        });
    };

    // Creates a new layer element for the given options for use in the main plugin definition
    // TODO Unit tests
    $.fn.multiBackground._createLayer = function(options) {
        // Check background type
        if("string" !== typeof options["type"]) {
            throw "Plugin options must specify a \"type\" param with a value of type \"string\"";
        }
        var $layer;
        switch(options["type"].toLowerCase()) {
            case "solid":
                $layer = $.fn.multiBackground._createSolid(options);
                break;
            case "gradient":
                $layer = $.fn.multiBackground._createGradient(options);
                break;
            case "image":
                $layer = $.fn.multiBackground._createMovable(options, $.fn.multiBackground._createImage);
                break;
            case "pattern":
                $layer = $.fn.multiBackground._createMovable(options, $.fn.multiBackground._createPattern);
                break;
            case "video":
                $layer = $.fn.multiBackground._createMovable(options, $.fn.multiBackground._createVideo);
                break;
            case "youtube":
                $layer = $.fn.multiBackground._createMovable(options, $.fn.multiBackground._createYouTube);
                break;
            case "vimeo":
                $layer = $.fn.multiBackground._createMovable(options, $.fn.multiBackground._createVimeo);
                break;
            case "iframe":
                $layer = $.fn.multiBackground._createIFrame(options);
                break;
            case "gmap":
                $layer = $.fn.multiBackground._createGMap(options);
                break;
            default:
                throw "Unsupported background type: \"" + options["type"] + "\"";
        }

        // Prepare layer
        $layer.css({"position": "absolute", "top": 0, "left": 0});
        return $layer;
    };

    // Plugin definition for type: Solid
    // Available options params and structures are as follows:
    // "color": A parseable string color representation
    // TODO Unit tests
    $.fn.multiBackground._createSolid = function(options) {
        // Check and create a color
        if("string" !== typeof options["color"]) {
            throw "Plugin options must specify a \"color\" param with a value of type \"string\"";
        }
        var color = new MultiBackgroundColor(options["color"]);

        // Create solid color element
        var $element = $("<div/>");
        $element.css({"width": "100%", "height": "100%", "min-width": 0, "max-width": "none", "min-height": 0, "max-height": "none", "opacity": 0, "background": color.getRGBA()});
        if(color.isTranslucent()) {
            $element.attr("data-multibackground-translucent", "");
        }
        if("undefined" === typeof $element.parents('[data-multibackground]').attr('data-multibackground-slideshow-direction')) {
            $.fn.multiBackground._transite(options["transitionloaded"], $element, 1);
        }
        return $element;
    };

    // Plugin definition for type: Gradient
    // Available options params and structures are as follows:
    // "direction": A string value to specify gradient direction, possible values are: "horizontal", "vertical", "diagonalUp", "diagonalDown", "radial"
    // "points": An array of point objects, each of which have the following structure:
    // "position": A float from 0 to 1, which defines the position of the point (will be converted to %)
    // "color": A MultiBackgroundColor object
    // TODO Unit tests
    $.fn.multiBackground._createGradient = function(options) {
        // Check direction
        if("string" !== typeof options["direction"]) {
            throw "Plugin options must specify a \"direction\" param with a value of type \"string\"";
        }
        var gType, gMoz, gWebkit, gWebkitR, gO, gMs, gW3, gIE;
        switch(options["direction"]) {
            case "horizontal":
                gType       = "linear";
                gMoz        = "left";
                gWebkit     = "left top, right top";
                gWebkitR    = "left";
                gO          = "left";
                gMs         = "left";
                gW3         = "to right";
                gIE         = "1";
                break;
            case "vertical":
                gType       = "linear";
                gMoz        = "top";
                gWebkit     = "left top, left bottom";
                gWebkitR    = "top";
                gO          = "top";
                gMs         = "top";
                gW3         = "to bottom";
                gIE         = "0";
                break;
            case "diagonalUp":
                gType       = "linear";
                gMoz        = "45deg";
                gWebkit     = "left bottom, right bottom";
                gWebkitR    = "45deg";
                gO          = "45deg";
                gMs         = "45deg";
                gW3         = "45deg";
                gIE         = "1";
                break;
            case "diagonalDown":
                gType       = "linear";
                gMoz        = "-45deg";
                gWebkit     = "left top, right bottom";
                gWebkitR    = "-45deg";
                gO          = "-45deg";
                gMs         = "-45deg";
                gW3         = "135deg";
                gIE         = "1";
                break;
            case "radial":
                gType       = "radial";
                gMoz        = "center, ellipse cover";
                gWebkit     = "radial, center center, 0px, center center, 100%";
                gWebkitR    = "center, ellipse cover";
                gO          = "center, ellipse cover";
                gMs         = "center, ellipse cover";
                gW3         = "ellipse at center";
                gIE         = "1";
                break;
            default:
                throw "Unsupported gradient direction: \"" + options["direction"] + "\"";
        }

        // Check points
        if("object" !== typeof options["points"] || "[object Array]" !== Object.prototype.toString.call(options["points"])) {
            throw "Plugin options must specify a \"points\" param with a value of type \"array\"";
        }
        if(0 === options["points"].length) {
            throw "Plugin options param \"points\" cannot be an empty array";
        }

        // Walk points and build CSS stops
        var colors = [], stopsSimple = [], stopsFull = [], hasTranslucent = false;
        for(var key in options["points"]) {
            var position = parseFloat(options["points"][key]["position"]) * 100;
            if(isNaN(position)) {
                throw "Each gradient point must specify a param \"position\" with a value of type \"float\"";
            }
            if("string" !== typeof options["points"][key]["color"]) {
                throw "Each gradient point must specify a param \"color\" with a value of type \"string\"";
            }
            var color = new MultiBackgroundColor(options["points"][key]["color"]);
            if(color.isTranslucent()) {
                hasTranslucent = true;
            }
            colors.push(color);
            stopsSimple.push(color.getRGBA() + " " + position + "%");
            stopsFull.push("color-stop(" + position + "%, " + color.getRGBA() + ")");
        }

        // Create element and apply background gradient CSS
        var $element = $("<div/>");
        $element.attr("style", "width:100%;height:100%;min-width:0;max-width:none;min-height:0;max-height:none;opacity:0;background:" + colors[0].getRGB() + ";background:-moz-" + gType + "-gradient(" + gMoz + "," + stopsSimple.join(",") + ");background:-webkit-gradient(" + gWebkit + "," + stopsFull.join(",") + ");background:-webkit-" + gType + "-gradient(" + gWebkitR + "," + stopsSimple.join(",") + ");background:-o-" + gType + "-gradient(" + gO + "," + stopsSimple.join(",") + ");background:-ms-" + gType + "-gradient(" + gMs + "," + stopsSimple.join(",") + ");background:" + gType + "-gradient(" + gW3 + "," + stopsSimple.join(",") + ");background:progid:DXImageTransform.Microsoft.gradient(startColorstr='" + colors[0].getHEX() + "',endColorstr='" + colors[colors.length - 1].getHEX() + "',GradientType=" + gIE + ")" + ";");
        if(hasTranslucent) {
            $element.attr("data-multibackground-translucent", "");
        }
        if("undefined" === typeof $element.parents('[data-multibackground]').attr('data-multibackground-slideshow-direction')) {
            $.fn.multiBackground._transite(options["transitionloaded"], $element, 1);
        }
        return $element;
    };

    // Plugin definition for type: Movable
    // Available options params and structures are as follows:
    // "attachment": A string value to specify attachment type, possible values are: "fixed", "static", "parallax"
    // "parallaxspeed" (only for "attachment": "parallax"): A float value to specify parallax speed (negative values will reverse the parallax direction) - 0 means no movement (if 0 works for you, do not use parallax attachment, use fixed!), if omitted, the default is used: 1
    // TODO Unit tests
    $.fn.multiBackground._createMovable = function(options, innerGenerator) {
        // Check attachment & offsets
        if("string" !== typeof options["attachment"]) {
            throw "Plugin options must specify an \"attachment\" param with a value of type \"string\"";
        }

        // Prepare initial requirements
        var $element = $("<div/>");
        var $window  = $(window);
        $element.css({"width": "100%", "height": "100%", "overflow": "hidden", "min-width": 0, "max-width": "none", "min-height": 0, "max-height": "none"});

        // Attachment based resizers
        switch(options["attachment"]) {
            case "fixed":
                var refresh = function(forceVisible) {
                    $.fn.multiBackground._refreshAttachment($element, true, false, false, 0, 'undefined' != typeof options['alignment'] && 'undefined' != typeof options['alignment']['horizontal'] ? options['alignment']['horizontal'] : 'center', 'undefined' != typeof options['alignment'] && 'undefined' != typeof options['alignment']['vertical'] ? options['alignment']['vertical'] : 'middle', forceVisible);
                    return true;
                };
                $element.data("mb-refresh", refresh);
                $element.bind("mb-refresh", refresh);
                $.fn.multiBackground._refreshEvents.add(refresh);
                break;
            case "static":
                 if (options["type"] === "image") {
                    break;
                }
                var refresh = function(forceVisible) {
                    $.fn.multiBackground._refreshAttachment($element, false, true, false, 0, 'undefined' != typeof options['alignment'] && 'undefined' != typeof options['alignment']['horizontal'] ? options['alignment']['horizontal'] : 'center', 'undefined' != typeof options['alignment'] && 'undefined' != typeof options['alignment']['vertical'] ? options['alignment']['vertical'] : 'middle', forceVisible);
                    return true;
                };
                $element.data("mb-refresh", refresh);
                $element.bind("mb-refresh", refresh);
                $.fn.multiBackground._refreshEvents.add(refresh);
                break;
            case "parallax":
                var parallaxSpeed   = parseFloat(options["parallaxspeed"]);
                if(isNaN(parallaxSpeed)) {
                    parallaxSpeed   = 1;
                }
                var refresh = function(forceVisible) {
                    $.fn.multiBackground._refreshAttachment($element, false, false, true, parallaxSpeed, 'undefined' != typeof options['alignment'] && 'undefined' != typeof options['alignment']['horizontal'] ? options['alignment']['horizontal'] : 'center', 'undefined' != typeof options['alignment'] && 'undefined' != typeof options['alignment']['vertical'] ? options['alignment']['vertical'] : 'middle', forceVisible);
                    return true;
                };
                $element.data("mb-refresh", refresh);
                $element.bind("mb-refresh", refresh);
                $.fn.multiBackground._refreshEvents.add(refresh);
                break;
            default:
                throw "Unsupported attachment: \"" + options["attachment"] + "\"";
        }

        // Return element
        return innerGenerator($element, options);
    };

    // Plugin definition for type: Image
    // Available options params and structures are as follows:
    // "url": A string value to specify source image URL
    // TODO Unit tests
    $.fn.multiBackground._createImage = function($element, options) {
        // Check URL
        if("string" !== typeof options["url"]) {
            throw "Plugin options must specify an \"url\" param with a value of type \"string\"";
        }
        if ("static" === options["attachment"]) {
          $element.css({ "background-size": "cover", "background-image": "url(\""+ options["url"] + "\")","background-attachment": "fixed" });
          return $element;
        }
        // Load image & trigger background refresh once ready
        var image = new Image();
        $(image).bind("load error", function(e) {
            $(this).unbind("load error");
            if("load" !== e.type) {
                return $(this);
            }
            var $image = $("<img src=\"" + options["url"] + "\" alt=\"\" data-multibackground-inner/>");
            $image.css({"position": "absolute", "left": 0, "top": 0, "opacity": 0, "min-width": 0, "max-width": "none", "min-height": 0, "max-height": "none"});
            $element.data("mb-ready", true);
            $element.data("mb-width", image.width);
            $element.data("mb-height", image.height);
            $element.append($image);
            $element.triggerHandler("mb-refresh");
            if("undefined" === typeof $element.parents('[data-multibackground]').attr('data-multibackground-slideshow-direction')) {
                $.fn.multiBackground._transite(options["transitionloaded"], $image, 1);
            } else {
                $image.css("opacity", 1);
            }
        });
        image.src = options["url"];

        if(null !== options["url"].match(/\.png$/i)) {
            $element.attr("data-multibackground-translucent", "");
        }

        return $element;
    };

    // Plugin definition for type: Pattern
    // Available options params and structures are as follows:
    // "url": A string value to specify source image URL
    // TODO Unit tests
    $.fn.multiBackground._createPattern = function($element, options) {
        // Check URL
        if("string" !== typeof options["url"]) {
            throw "Plugin options must specify an \"url\" param with a value of type \"string\"";
        }

        // Load image & trigger background refresh once ready
        var image = new Image();
        $(image).bind("load error", function(e) {
            $(this).unbind("load error");
            if("load" !== e.type) {
                return $(this);
            }
            var $pattern = $("<div style=\"background:url(" + options["url"] + ")\" data-multibackground-inner/>");
            $pattern.css({"position": "absolute", "left": 0, "top": 0, "opacity": 0, "min-width": 0, "max-width": "none", "min-height": 0, "max-height": "none"});
            $element.data("mb-ready", true);
            $element.data("mb-width", image.width);
            $element.data("mb-height", image.height);
            $element.append($pattern);
            $element.triggerHandler("mb-refresh");
            if("undefined" === typeof $element.parents('[data-multibackground]').attr('data-multibackground-slideshow-direction')) {
                $.fn.multiBackground._transite(options["transitionloaded"], $pattern, 1);
            } else {
                $pattern.css("opacity", 1);
            }
        });

        image.src = options["url"];

        if(null !== options["url"].match(/\.png$/i)) {
            $element.attr("data-multibackground-translucent", "");
        }

        return $element;
    };

    // Plugin definition for type: Video
    // Available options params and structures are as follows:
    // "url": An object value to specify source video URLs, keys can be "mp4", "ogg" or "webm", at least one should be present
    // "video": An object value to specify video specific options
    // TODO Unit tests
    $.fn.multiBackground._createVideo = function($element, options) {
        // Check URL
        if("object" !== typeof options["url"]) {
            throw "Plugin options must specify an \"url\" param with a value of type \"object\"";
        }
        if("string" !== typeof options["url"]["mp4"] && "string" !== typeof options["url"]["ogg"] && "string" !== typeof options["url"]["webm"]) {
            throw "Plugin options must specify an \"url\" param (of type \"object\") with a value of type \"string\" for at least one of the following keys: \"mp4\", \"ogg\" or \"webm\", preferable for all";
        }

        // Flags
        var autoplay    = $.fn.multiBackground._isTrue(options["video"]["autoplay"]);
        var loop        = $.fn.multiBackground._isTrue(options["video"]["loop"]);
        var muted       = $.fn.multiBackground._isTrue(options["video"]["muted"]);

        // Create video element
        var $video  = $("<video preload=\"metadata\"" + (autoplay ? " autoplay=\"autoplay\"" : "") + (loop ? " loop=\"loop\"" : "") + (muted ? " muted=\"muted\"" : "") + " data-multibackground-inner>" + ("string" === typeof options["url"]["mp4"] ? "<source src=\"" + options["url"]["mp4"] + "\" type=\"video/mp4\">" : "") + ("string" === typeof options["url"]["webm"] ? "<source src=\"" + options["url"]["webm"] + "\" type=\"video/webm\">" : "") + ("string" === typeof options["url"]["ogg"] ? "<source src=\"" + options["url"]["ogg"] + "\" type=\"video/ogg\">" : "") + "</video>");
        if(autoplay) {
            $video.prop("autoplay", true);
        }
        if(loop) {
            $video.prop("loop", true);
        }
        if(muted) {
            $video.prop("muted", true);
        }

        // Load video & trigger background refresh once metadata has been loaded
        $video.bind("loadedmetadata canplay", function() {
            $video.unbind("loadedmetadata canplay");
            $element.data("mb-ready", true);
            $element.data("mb-width", this.videoWidth);
            $element.data("mb-height", this.videoHeight);
            $element.triggerHandler("mb-refresh");
            if("undefined" === typeof $element.parents('[data-multibackground]').attr('data-multibackground-slideshow-direction')) {
                $.fn.multiBackground._transite(options["transitionloaded"], $video, 1);
            } else {
                $video.css("opacity", 1);
            }
            if(loop) {
                $video.get(0).loop  = true;
            }
            if(muted) {
                $video.get(0).muted = true;
            }
            if(autoplay) {
                $video.get(0).play();
            }
        });

        // Prepare video & attach to element
        $video.attr("style", "position:absolute;left:0;top:0;opacity:0;min-width:0;max-width:none;min-height:0;max-height:none");
        $video.append(options["video"]["nohtml5support"]);
        $element.data("mb-video-player", new MultiBackgroundHTML5PlayerWrapper($video.get(0)));
        $element.append($video);
        return $element;
    };

    // Plugin definition for type: YouTube
    // Available options params and structures are as follows:
    // "id": A string value to specify source YouTube video ID
    // "video": An object value to specify video specific options
    // TODO Unit tests
    $.fn.multiBackground._createYouTube = function($element, options) {
        // Check video id
        if("string" !== typeof options["id"]) {
            throw "Plugin options must specify an \"id\" param with a value of type \"string\"";
        }

        // Create video element
        var id      = "mbswf" + (new Date()).getTime();
        var $video  = $("<div id=\"" + id + "\"/>");

        // Load the YouTube API & wait for it to load
        if(0 === $("#youtube-api").length) {
            var $script = $("<script src=\"http://www.youtube.com/player_api\" id=\"youtube-api\"/>");
            $("script").first().before($script);
        }
        var apiLoaded = function() {
            $element.data("mb-video-player", new MultiBackgroundYouTubePlayerWrapper(new YT.Player(id, {
                "width": options["video"]["width"],
                "height": options["video"]["height"],
                "videoId": options["id"],
                "playerVars": {
                    "showinfo": 0,
                    "controls": 0
                },
                "events": {
                    "onReady": function(e) {
                        var $video = $("#" + id);
                        $video.attr("data-multibackground-inner", "")
                        $element.data("mb-ready", true);
                        $element.data("mb-width", options["video"]["width"]);
                        $element.data("mb-height", options["video"]["height"]);
                        if($.fn.multiBackground._isTrue(options["video"]["autoplay"])) {
                            e.target.playVideo()
                        } else {
                            e.target.stop();
                        }
                        if(options["video"]["muted"]) {
                            e.target.mute()
                        } else {
                            e.target.unMute();
                        }
                        $element.triggerHandler("mb-refresh");
                        if("undefined" === typeof $element.parents('[data-multibackground]').attr('data-multibackground-slideshow-direction')) {
                            $.fn.multiBackground._transite(options["transitionloaded"], $video, 1);
                        } else {
                            $video.css("opacity", 1);
                        }
                    },
                    "onStateChange": function(e) {
                        if(e.data === YT.PlayerState.ENDED && $.fn.multiBackground._isTrue(options["video"]["loop"])) {
                            e.target.playVideo();
                        }
                    }
                }
            })));
        };
        if(mb_YouTubeAPIReady) {
            apiLoaded();
        } else {
            var interval = setInterval(function() {
                if(mb_YouTubeAPIReady) {
                    clearInterval(interval);
                    apiLoaded();
                }
            }, 100);
        }

        // Prepare video & attach to element
        $video.attr("style", "position:absolute;left:0;top:0;opacity:0;min-width:0;max-width:none;min-height:0;max-height:none");
        $element.append($video);
        return $element;
    };

    // Plugin definition for type: Vimeo
    // Available options params and structures are as follows:
    // "id": A string value to specify source Vimeo video ID
    // "video": An object value to specify video specific options
    // TODO Unit tests
    $.fn.multiBackground._createVimeo = function($element, options) {
        // Check video id
        if("string" !== typeof options["id"]) {
            throw "Plugin options must specify an \"id\" param with a value of type \"string\"";
        }

        // Create video element
        var $video  = $("<iframe src=\"http://player.vimeo.com/video/" + options["id"] + "?api=1&badge=0&byline=0&title=0&autoplay=" + ($.fn.multiBackground._isTrue(options["video"]["autoplay"]) ? 1 : 0) + "&loop=" + ($.fn.multiBackground._isTrue(options["video"]["loop"]) ? 1 : 0) + "\" frameborder=\"0\" webkitallowfullscreen mozallowfullscreen allowfullscreen data-multibackground-inner/>");

        // Attach listeners
        var onMessageReceived = function(e) {
            var data = JSON.parse(e.data);
            if("ready" === data.event && true !== $element.data("mb-ready")) {
                $video.get(0).contentWindow.postMessage({"method": "setVolume", "value": $.fn.multiBackground._isTrue(options["video"]["muted"]) ? 0 : 1}, "*");
                $element.data("mb-ready", true);
                $element.data("mb-width", options["video"]["width"]);
                $element.data("mb-height", options["video"]["height"]);
                $element.triggerHandler("mb-refresh");
                if("undefined" === typeof $element.parents('[data-multibackground]').attr('data-multibackground-slideshow-direction')) {
                    $.fn.multiBackground._transite(options["transitionloaded"], $video, 1);
                } else {
                    $video.css("opacity", 1);
                }
            }
        };
        if(window.addEventListener) {
            window.addEventListener("message", onMessageReceived, false);
        } else {
            window.attachEvent("onmessage", onMessageReceived, false);
        }

        // Prepare video & attach to element
        $video.attr("style", "position:absolute;left:0;top:0;opacity:0;min-width:0;max-width:none;min-height:0;max-height:none");
        $element.append($video);
        $element.data("mb-video-player", new MultiBackgroundVimeoPlayerWrapper($video.get(0)));
        return $element;
    };

    // Plugin definition for type: iframe
    // Available options params and structures are as follows:
    // "url": A string value to specify source iframe URL
    // TODO Unit tests
    $.fn.multiBackground._createIFrame = function(options) {
        // Check URL
        if("string" !== typeof options["url"]) {
            throw "Plugin options must specify an \"url\" param with a value of type \"string\"";
        }

        // Create and prepare the iframe
        var $element  = $("<iframe src=\"" + options["url"] + "\" scrolling=\"no\" style=\"width:100%;height:100%;border:0;opacity:0;min-width:0;max-width:none;min-height:0;max-height:none;overflow:hidden\"/>");
        $element.bind("load", function() {
            $element.unbind("load");
            if("undefined" === typeof $element.parents('[data-multibackground]').attr('data-multibackground-slideshow-direction')) {
                $.fn.multiBackground._transite(options["transitionloaded"], $element, 1);
            }
        });
        return $element;
    };

    // Plugin definition for type: gmap
    // Available options params and structures are as follows:
    // "apikey": A string value to specify google api key
    // "latitude": A float value to specify location latitude
    // "longitude": A float value to specify location longitude
    // "gmap": An object value to specify google map specific options, which (if omitted) use the default values, which are:
    // "zoom": An integer value to specify map zoom
    // TODO Unit tests
    $.fn.multiBackground._createGMap = function(options) {
        // Check API key
        if("string" !== typeof options["apikey"]) {
            throw "Plugin options must specify an \"apikey\" param with a value of type \"string\"";
        }

        // Check latitude
        if(isNaN(parseFloat(options["latitude"]))) {
            throw "Plugin options must specify an \"latitude\" param with a value of type \"float\"";
        }

        // Check longitude
        if(isNaN(parseFloat(options["longitude"]))) {
            throw "Plugin options must specify an \"longitude\" param with a value of type \"float\"";
        }

        // Load the Google Maps API & wait for it to load
        if(0 === $("#gmaps-api").length) {
            var $script = $("<script src=\"https://maps.googleapis.com/maps/api/js?v=3&language=" + options["gmap"]["language"] + "&key=" + options["apikey"] + "&callback=onGoogleMapsAPIReady\" id=\"gmaps-api\"/>");
            $("script").first().before($script);
        }

        // Continue execution once the API has loaded & is ready
        var apiLoaded = function() {
            // Configure & create map
            var mapOptions = {
                "center": new google.maps.LatLng(parseFloat(options["latitude"]), parseFloat(options["longitude"])),
                "zoom": parseInt(options["gmap"]["zoom"])
            };
            var map = new google.maps.Map($element.get(0), mapOptions);
            if("object" === typeof options["gmap"]["marker"]) {
                var markerOptions = {
                    map: map,
                    position: "object" === typeof options["gmap"]["marker"]["position"] ? options["gmap"]["marker"]["position"] : mapOptions["center"]
                };
                if("string" === typeof options["gmap"]["marker"]["icon"]) {
                    markerOptions["icon"] = options["gmap"]["marker"]["icon"];
                }
                var marker = new google.maps.Marker(markerOptions);
            }
            if("undefined" === typeof $element.parents('[data-multibackground]').attr('data-multibackground-slideshow-direction')) {
                $.fn.multiBackground._transite(options["transitionloaded"], $element, 1);
            }
        };
        if(mb_GoogleMapsAPIReady) {
            apiLoaded();
        } else {
            var interval = setInterval(function() {
                if(mb_GoogleMapsAPIReady) {
                    clearInterval(interval);
                    apiLoaded();
                }
            }, 100);
        }

        // Create and prepare the element
        var $element  = $("<div/>");
        $element.attr("style", "width:100%;height:100%;opacity:0;min-width:0;max-width:none;min-height:0;max-height:none");
        return $element;
    };

    // Add a preloader to the element
    $.fn.multiBackground._loader = function($element) {
        if(0 < $element.children(".mb-s").length) {
            return $element;
        }
        $element.prepend('<div class="mb-s" style="width:64px;height:64px;position:absolute;top:50%;left:50%;margin:-32px 0 0 -32px"><svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 100"><g transform="rotate(-45 50 50)"><g><g><g><g transform="translate(50,50)"><g><rect x="0" y="0" width="30" height="30" fill="#ff5722" transform="rotate(45 15 15) translate(-21.21320343559643,0)"><animate attributeName="fill" values="#ff5722;#ff5722;#00bcd4;#ff5722;#8bc34a;#ff5722;#ffc107;#ff5722;#ff5722" keyTimes="0;.125;.25;.375;.5;.625;.75;.875;1" calcMode="spline" keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1" begin="0s" dur="8" repeatCount="indefinite"/></rect><animateTransform attributeName="transform" type="scale" values=".35;.35;1;1;.35;.35" keyTimes="0;.1;.4;.6;.9;1" calcMode="spline" keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1" begin="0s" dur="2s" repeatCount="indefinite"/></g></g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -28.78679656440357;0 -28.78679656440357;0 0;0 0" keyTimes="0;.1;.4;.6;.9;1" calcMode="spline" keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1" begin="0s" dur="2s" repeatCount="indefinite"/></g><animateTransform attributeName="transform" type="rotate" values="0 50 21.21320343559643;0 50 21.21320343559643;180 50 21.21320343559643;360 50 21.21320343559643;360 50 21.21320343559643" keyTimes="0;.1;.5;.9;1" calcMode="spline" keySplines="0 0 .5 1;0 0 .5 1;0 0 1 .5;0 0 1 .5" begin="0s" dur="2s" repeatCount="indefinite"/></g></g><g transform="rotate(90 50 50)"><g><g><g transform="translate(50,50)"><g><rect x="0" y="0" width="30" height="30" fill="#00bcd4" transform="rotate(45 15 15) translate(-21.21320343559643,0)"><animate attributeName="fill" values="#ff5722;#00bcd4;#00bcd4;#00bcd4;#8bc34a;#00bcd4;#ffc107;#00bcd4;#ff5722" keyTimes="0;.125;.25;.375;.5;.625;.75;.875;1" calcMode="spline" keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1" begin="0s" dur="8" repeatCount="indefinite"/></rect><animateTransform attributeName="transform" type="scale" values=".35;.35;1;1;.35;.35" keyTimes="0;.1;.4;.6;.9;1" calcMode="spline" keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1" begin="0s" dur="2s" repeatCount="indefinite"/></g></g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -28.78679656440357;0 -28.78679656440357;0 0;0 0" keyTimes="0;.1;.4;.6;.9;1" calcMode="spline" keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1" begin="0s" dur="2s" repeatCount="indefinite"/></g><animateTransform attributeName="transform" type="rotate" values="0 50 21.21320343559643;0 50 21.21320343559643;180 50 21.21320343559643;360 50 21.21320343559643;360 50 21.21320343559643" keyTimes="0;.1;.5;.9;1" calcMode="spline" keySplines="0 0 .5 1;0 0 .5 1;0 0 1 .5;0 0 1 .5" begin="0s" dur="2s" repeatCount="indefinite"/></g></g><g transform="rotate(180 50 50)"><g><g><g transform="translate(50,50)"><g><rect x="0" y="0" width="30" height="30" fill="#8bc34a" transform="rotate(45 15 15) translate(-21.21320343559643,0)"><animate attributeName="fill" values="#ff5722;#8bc34a;#00bcd4;#8bc34a;#8bc34a;#8bc34a;#ffc107;#8bc34a;#ff5722" keyTimes="0;.125;.25;.375;.5;.625;.75;.875;1" calcMode="spline" keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1" begin="0s" dur="8" repeatCount="indefinite"/></rect><animateTransform attributeName="transform" type="scale" values=".35;.35;1;1;.35;.35" keyTimes="0;.1;.4;.6;.9;1" calcMode="spline" keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1" begin="0s" dur="2s" repeatCount="indefinite"/></g></g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -28.78679656440357;0 -28.78679656440357;0 0;0 0" keyTimes="0;.1;.4;.6;.9;1" calcMode="spline" keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1" begin="0s" dur="2s" repeatCount="indefinite"/></g><animateTransform attributeName="transform" type="rotate" values="0 50 21.21320343559643;0 50 21.21320343559643;180 50 21.21320343559643;360 50 21.21320343559643;360 50 21.21320343559643" keyTimes="0;.1;.5;.9;1" calcMode="spline" keySplines="0 0 .5 1;0 0 .5 1;0 0 1 .5;0 0 1 .5" begin="0s" dur="2s" repeatCount="indefinite"/></g></g><g transform="rotate(270 50 50)"><g><g><g transform="translate(50,50)"><g><rect x="0" y="0" width="30" height="30" fill="#ffc107" transform="rotate(45 15 15) translate(-21.21320343559643,0)"><animate attributeName="fill" values="#ff5722;#ffc107;#00bcd4;#ffc107;#8bc34a;#ffc107;#ffc107;#ffc107;#ff5722" keyTimes="0;.125;.25;.375;.5;.625;.75;.875;1" calcMode="spline" keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1" begin="0s" dur="8" repeatCount="indefinite"/></rect><animateTransform attributeName="transform" type="scale" values=".35;.35;1;1;.35;.35" keyTimes="0;.1;.4;.6;.9;1" calcMode="spline" keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1" begin="0s" dur="2s" repeatCount="indefinite"/></g></g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -28.78679656440357;0 -28.78679656440357;0 0;0 0" keyTimes="0;.1;.4;.6;.9;1" calcMode="spline" keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1" begin="0s" dur="2s" repeatCount="indefinite"/></g><animateTransform attributeName="transform" type="rotate" values="0 50 21.21320343559643;0 50 21.21320343559643;180 50 21.21320343559643;360 50 21.21320343559643;360 50 21.21320343559643" keyTimes="0;.1;.5;.9;1" calcMode="spline" keySplines="0 0 .5 1;0 0 .5 1;0 0 1 .5;0 0 1 .5" begin="0s" dur="2s" repeatCount="indefinite"/></g></g><circle cx="50" cy="50" r="25" fill="#ff5722"><animate attributeName="r" values="25;0;0;25" keyTimes="0;.2;.85;1" calcMode="spline" keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1" begin="0s" dur="2s" repeatCount="indefinite"/><animate attributeName="fill" values="#ff5722;#ff5722;#00bcd4;#00bcd4;#00bcd4;#8bc34a;#8bc34a;#8bc34a;#ffc107;#ffc107;#ffc107;#ff5722;#ff5722" keyTimes="0;.05;.051;.25;.3;.301;.5;.55;.551;.75;.8;.801;1" begin="0s" dur="8s" repeatCount="indefinite"/></circle><animateTransform attributeName="transform" type="rotate" values="-45 50 50;45 50 50;135 50 50;225 50 50;315 50 50" keyTimes="0;.25;.5;.75;1" calcMode="spline" keySplines=".5 0 .5 1;.5 0 .5 1;.5 0 .5 1;.5 0 .5 1" begin="0s" dur="8s" repeatCount="indefinite"/></g></svg></div?');
        return $element;
    };

    // Refresh position and size for all attachment types
    // TODO Unit tests
    $.fn.multiBackground._refreshAttachment = function($element, isFixed, isStatic, isParallax, parallaxSpeed, horizontalAlignment, verticalAlignment, forceVisible) {
        if(true !== forceVisible && (true !== $element.data("mb-ready") || !$.fn.multiBackground._isVisible($element, true))) {
            return this;
        }

        var $window         = $(window),
            windowWidth     = $window.width(),
            windowHeight    = $window.height(),
            viewportWidth   = $element.width(),
            viewportHeight  = $element.height(),
            elementRatio    = $element.data("mb-width") / $element.data("mb-height"),
            elementWidth    = viewportWidth,
            elementHeight   = Math.round(elementWidth / elementRatio);

        if(isParallax) {
            if(elementHeight < viewportHeight) {
                elementHeight   = viewportHeight;
                elementWidth    = elementHeight * elementRatio;
            }
            elementHeight       = Math.round(Math.max(elementHeight, viewportHeight * (1 + Math.abs(parallaxSpeed))));
            elementWidth        = Math.round(elementHeight * elementRatio);
        } else {
            if(isStatic) {
                if(elementHeight < windowHeight) {
                    elementHeight   = windowHeight;
                    elementWidth    = Math.round(elementHeight * elementRatio);
                }
            } else {
                if(elementHeight < viewportHeight) {
                    elementHeight   = viewportHeight;
                    elementWidth    = Math.round(elementHeight * elementRatio);
                }
            }
        }

        var positionLeft    = Math.round((viewportWidth - elementWidth) / 2),
            positionTop     = Math.round((viewportHeight - elementHeight) / 2);

        if(isParallax) {
            var offset      = $element.offset().top,
                min         = offset - $window.height(),
                max         = offset + viewportHeight,
                current     = Math.min(1, Math.max(0, ($window.scrollTop() - min) / (max - min)));
            positionTop     = Math.round((viewportHeight - elementHeight) * (0 > parallaxSpeed ? current : 1 - current));
        } else if(isStatic) {
            positionTop     = Math.round((windowHeight - elementHeight) / 2) - $element.offset().top + $window.scrollTop();
        } else {
            switch(verticalAlignment) {
                case 'top':
                    positionTop     = 0;
                    break;
                case 'bottom':
                    positionTop     = viewportHeight - elementHeight;
                    break;
            }
            switch(horizontalAlignment) {
                case 'left':
                    positionLeft    = 0;
                    break;
                case 'right':
                    positionLeft    = viewportWidth - elementWidth;
                    break;
            }
        }

        $element.find("> [data-multibackground-inner]").css({"width": elementWidth + "px", "height": elementHeight + "px", "left": positionLeft + "px", "top": positionTop + "px"});

        return this;
    };

    // Determines if all the given layers are marked as ready (e.g. their content has finished loading)
    $.fn.multiBackground._layersReady = function(layers) {
        for(var i = 0; i < layers.length; i++) {
            if(true !== $(layers[i]).data("mb-ready")) {
                return false;
            }
        }
        return true;
    };

    // Determines if the given element is currently visible
    // Visible means, that all of the following conditions must be met:
    // 1. It should not be :hidden or opacity: 0.
    // 2. It should not be completely outside of the viewport, where the viewport is defined by the window, or any parent element with overflow: hidden.
    // 3. There should not be any visible elements completely overlaying the current one (as this is extremely heavy to calculate, it is only checked if strict is set to true).
    $.fn.multiBackground._isVisible = function($element, strict) {
        var overlap = function($element, $canvas, contained) {
            var ax1 = 0,
                ax2 = 0,
                ay1 = 0,
                ay2 = 0,
                bx1 = 0,
                bx2 = 0,
                by1 = 0,
                by2 = 0;
            if("undefined" !== typeof $element.offset()) {
                ax1 = $element.offset().left;
                ay1 = $element.offset().top;
            }
            if($canvas.get(0) === window) {
                bx1 = $canvas.scrollLeft();
                by1 = $canvas.scrollTop();
            } else if("undefined" !== typeof $canvas.offset()) {
                bx1 = $canvas.offset().left;
                by1 = $canvas.offset().top;
            }
            ax2 = ax1 + $element.width();
            ay2 = ay1 + $element.height();
            bx2 = bx1 + $canvas.width();
            by2 = by1 + $canvas.height();
            if(true === contained) {
                return (ax1 >= bx1 && ax2 <= bx2 && ay1 >= by1 && by2 <= by2);
            } else {
                return !(ax1 >= bx2 || ax2 <= bx1 || ay1 >= by2 || ay2 <= by1);
            }
        };

        var opacity = function($element, callback) {
            while(0 !== $element.length && $element.get(0) !== document) {
                if(callback($.fn.multiBackground._opacity($element))) {
                    return true;
                }
                $element = $element.parent();
            }
            return false;
        };

        var visible = function($element, overlay) {
            if("none" === $element.css("display")) {
                return false;
            }
            if(true === overlay) {
                if(opacity($element, function(opacity) {
                    return 1 > opacity;
                })) {
                    return false;
                }
            } else {
                if(opacity($element, function(opacity) {
                    return 0 === opacity;
                })) {
                    return false;
                }
            }
            var canvas  = [$(window)];
            var $parent = $element.parent();
            while(0 !== $parent.length && $parent.get(0) !== document) {
                if("hidden" === $parent.css("overflow")) {
                    canvas.push($parent);
                }
                $parent = $parent.parent();
            }
            for(var i = 0; i < canvas.length; i++) {
                if(!overlap($element, canvas[i], false)) {
                    return false;
                }
            }
            return true;
        };

        var mark    = function($element) {
            while(0 !== $element.length && $element.get(0) !== document) {
                if($element.is("[data-multibackground-content], [data-multibackground-translucent]")) {
                    return true;
                }
                $element = $element.parent();
            }
            return false;
        };

        if(!visible($element)) {
            return false;
        }

        if(true === strict) {
            var $i,
                $array  = $element.parent().find("*");
            for(var i = $array.index($element) + $element.find("*").length + 1; i < $array.length; i++) {
                $i      = $array.eq(i);
                if(!mark($i) && visible($i, true) && overlap($element, $i, true)) {
                    return false;
                }
            }
        }

        return true;
    };

    // Parses the given HTML attribute name substring and value map to a structured tree object
    // TODO Unit tests
    $.fn.multiBackground._parseMap = function(map) {
        var tree = {};
        for(var key in map) {
            var trail = key.split("-");
            var subTree = map[key];
            for(var i = trail.length - 1; i >= 0; i--) {
                var val = subTree;
                subTree = {};
                subTree[trail[i]] = val;
            }
            tree = $.extend(true, {}, tree, subTree);
        }
        return $.fn.multiBackground._parseObjectIntoArray(tree);
    };

    // Extracts a structured options object from the HTML attributes of the given element
    // TODO Unit tests
    $.fn.multiBackground._extractOptions = function($element) {
        var regex   = new RegExp("^data\\-multibackground\\-layer\\-(.*)$");
        var map     = {};
        for(var attr, i = 0, attrs = $element.get(0).attributes, l = attrs.length; i < l; i++) {
            attr    = attrs[i];
            if(!regex.test(attr.nodeName)) {
                continue;
            }
            map[regex.exec(attr.nodeName)[1]] = attr.value;
        }
        map         = $.fn.multiBackground._parseMap(map);
        if("object" !== typeof map || "[object Array]" !== Object.prototype.toString.call(map)) {
            console.log("MBDEBUG: Parsed options map:", map);
            throw "Could not initialize MultiBackground from HTML attributes, could not parse proper options map (see console log)";
        }
        return map;
    };

    // Parses the given object (recursively) and converts objects into arrays where possible
    // TODO Unit tests
    $.fn.multiBackground._parseObjectIntoArray = function(object) {
        if("object" !== typeof object) {
            return object;
        }
        var array = [];
        var found = true;
        var index = 0;
        for(var key in object) {
            if(index !== parseInt(key)) {
                object[key] = $.fn.multiBackground._parseObjectIntoArray(object[key]);
                found = false;
            } else {
                array.push($.fn.multiBackground._parseObjectIntoArray(object[key]));
            }
            index++;
        }
        return found ? array : object;
    };

    // Get actual element opacity (taking CSS animations into account)
    $.fn.multiBackground._opacity = function($element) {
        return Math.round(parseFloat($element.css("opacity")) * 1000) / 1000;
    };

    // Transition animator
    $.fn.multiBackground._transite = function(animator, $element, opacity) {
        var useGPU = function() {
            if("undefined" === typeof $.fn.multiBackground._useGPU) {
                $.fn.multiBackground._useGPU = false;
                var props = ["-webkit-transition", "-moz-transition", "-o-transition", "-ms-transition", "transition"];
                for(var i in props) {
                    if("undefined" !== typeof $element.css(props[i])) {
                        $.fn.multiBackground._useGPU = props[i];
                        break;
                    }
                }
            }
            return $.fn.multiBackground._useGPU;
        };

        switch(typeof animator) {
            case "function":
                return animator($element, opacity);
            case "string":
                if("function" === typeof window[animator]) {
                    return window[animator]($element);
                }
                var easing,
                    duration,
                    animator = animator.split(",");
                if(
                    2 != animator.length ||
                    "string" !== typeof (easing = animator[0]) ||
                    isNaN(duration = parseInt(animator[1]))
                ) {
                    break;
                }

                if(50 > duration && 0 < duration) {
                    duration = 50;
                }

                var gpu = useGPU();
                if(false === gpu) {
                    if("undefined" === typeof $.easing[easing]) {
                        throw "Easing: " + easing + " is not defined";
                    }
                    $element.stop().animate({"opacity": opacity}, {"duration": duration, "easing": easing});
                } else {
                    $element.data("mb-transite-original", $element.css(gpu));
                    $element.css(gpu, "opacity " + (duration / 1000) + "s" + " " + easing + " 0s");
                    setTimeout(function() {
                        $element.css("opacity", opacity);
                    }, 1);
                    $element.data("mb-transite-clear-callback", function() {
                        $element.css(gpu, $element.data("mb-transite-original"));
                        $element.removeData("mb-transite-original");
                    });
                    $element.data("mb-transite-clear-timeout", setTimeout($element.data("mb-transite-clear-callback"), duration + 1));
                }

                return {"easing": easing, "duration": duration};
            default:
                throw "Unsupported transition animator type: \"" + (typeof animator) + "\"";
        }
    };

    // Transition animator force stop
    // TODO Unit tests
    $.fn.multiBackground._transiteStop = function($element) {
        $element.stop();
        if("undefined" !== typeof $element.data("mb-transite-clear-timeout")) {
            clearTimeout($element.data("mb-transite-clear-timeout"));
            $element.data("mb-transite-clear-callback")();
            $element.removeData("mb-transite-clear-callback").removeData("mb-transite-clear-timeout");
        }
    };

    // Checks if the given value can be evaluated to boolean true
    // TODO Unit tests
    $.fn.multiBackground._isTrue = function(value) {
        return true === value || "true" === value || 1 === parseInt(value);
    };

    // Slideshow controllers
    var MultiBackgroundSlideshow                        = function($handle) {
        // Flags & counters
        this.startForward                               = true;
        this.manualStarted                              = null;
        this.currentLayer                               = null;
        this.autoplay                                   = true;
        this.tick                                       = 0;
        this.tickDelay                                  = 10;

        // Slideshow direction
        var autoStartSlideshow                          = true;
        var direction                                   = $handle.attr('data-multibackground-slideshow-direction');
        switch(direction) {
            case 'manual':
                this.manualStarted                      = false;
            case 'forward':
                this.getPrev                            = function(current, total) {
                    return current <= 0 ? total - 1 : current - 1;
                };
                this.getNext                            = function(current, total) {
                    return current >= total - 1 ? 0 : current + 1;
                };
                if('manual' == direction) {
                    this.autoplay                       = false;
                }
                break;

            case 'backward':
                this.startForward                       = false;
                this.getPrev                            = function(current, total) {
                    return current >= total - 1 ? 0 : current + 1;
                };
                this.getNext                            = function(current, total) {
                    return current <= 0 ? total - 1 : current - 1;
                };
                break;

            case 'random':
                var rand                                = function(current, total) {
                    var random                          = Math.round(Math.random() * (total - 1));
                    return current == random ? rand(current, total) : random;
                };
                this.getPrev = this.getNext             = rand;
                break;

            default:
                throw "Unsupported slideshow direction: \"" + $handle.attr('data-multibackground-slideshow-direction') + "\"";
        }

        // References
        this.$handle                                    = $handle;

        // Run broker
        this.run();
    };

    // Slideshow runner / broker
    MultiBackgroundSlideshow.prototype.run              = function() {
        // References
        var self                                        = this;
        var $layers                                     = this.$handle.find('[data-multibackground-layer]');

        // Tick
        self.tick                                       += 10;

        // Wait for all layers to be available and ready
        if(0 == $layers.length || !$.fn.multiBackground._layersReady($layers)) {
            self.tick                                   = 0;
            setTimeout(function() { self.run() }, 10);
            return;
        }

        // Paused?
        if(!self.autoplay) {
            self.tick                                   -= 10;

            // Auto-play is off in two cases: paused / stopped playback or manual mode
            // If manualStarted is boolean then playback is in manual mode, if it's NULL then it's paused / stopped
            // In case of manual mode playback should be started just once, for the first slide
            if(false === self.manualStarted) {
                self.manualStarted                      = true;
                self.slide(0);
            }
        }

        // Time to auto-play?
        if(self.tickDelay <= self.tick) {
            if(null === self.currentLayer) {
                self.currentLayer                       = self.startForward ? 0 : $layers.length - 1;
            }
            self.tick                                   = 0;
            self.tickDelay                              = self.slide(self.currentLayer);
            self.currentLayer                           = self.getNext(self.currentLayer, $layers.length)
        }

        // Reschedule run
        setTimeout(function() { self.run() }, 10);
    };

    // Start slideshow auto-play
    MultiBackgroundSlideshow.prototype.start            = function() {
        this.tick                                       = 0;
        this.tickDelay                                  = 10;
        this.autoplay                                   = true;
        return this;
    };

    // Stop slideshow auto-play
    MultiBackgroundSlideshow.prototype.stop             = function() {
        this.tick                                       = 0;
        this.tickDelay                                  = 10;
        this.autoplay                                   = false;
        return this;
    };

    // Pause slideshow auto-play
    MultiBackgroundSlideshow.prototype.pause            = function() {
        this.autoplay                                   = false;
        return this;
    };

    // Resume slideshow auto-play
    MultiBackgroundSlideshow.prototype.resume           = function() {
        this.autoplay                                   = true;
        return this;
    };

    // Slide to the specified layer number
    MultiBackgroundSlideshow.prototype.slide            = function(layer, transited) {
        // Make sure the target layer is on top
        var $target                                     = this.$handle.find('[data-multibackground-layer="' + layer + '"]');
        this.$handle.find('[data-multibackground-content]').before($target);

        // Refresh target layer and transite show
        $target.data('mb-refresh')(true);
        var transition                                  = $target.data('mb-slideshow').transition;
        var delay                                       = $target.data('mb-slideshow').delay;
        var transite                                    = $.fn.multiBackground._transite(transition, $target, 1);

        // Hide top-most (currently under target) layer after target has been fully shown
        setTimeout(function() {
            $target.prev().css('opacity', 0);
            if('function' == typeof transited) {
                transited();
            }
        }, transite.duration);

        // Total delay until next auto-play
        return transite.duration + delay;
    };

    // Slide to the previous layer
    MultiBackgroundSlideshow.prototype.prev             = function(transited) {
        return this.slide(this.currentLayer = this.getPrev(this.currentLayer, this.$handle.find('[data-multibackground-layer]').length), transited);
    };

    // Slide to the next layer
    MultiBackgroundSlideshow.prototype.next             = function(transited) {
        return this.slide(this.currentLayer = this.getNext(this.currentLayer, this.$handle.find('[data-multibackground-layer]').length), transited);
    };

    // Prepend or append a new layer
    MultiBackgroundSlideshow.prototype.prepend          =
    MultiBackgroundSlideshow.prototype.append           = function($layer, options) {
        $layer.css("opacity", 0);
        $layer.data("mb-slideshow", {
            transition: "undefined" === typeof options["slideshow"] || "undefined" === typeof options["slideshow"]["transition"] ? "linear,500" : options["slideshow"]["transition"],
            delay:      "undefined" === typeof options["slideshow"] || "undefined" === typeof options["slideshow"]["delay"] ? 2000 : parseInt(options["slideshow"]["delay"])
        });
        return this;
    };

    // Video player controls wrapper for HTML5 videos
    // TODO Unit tests
    function MultiBackgroundHTML5PlayerWrapper(element) {
        MultiBackgroundHTML5PlayerWrapper.prototype.element = element;
    }
    MultiBackgroundHTML5PlayerWrapper.prototype.element = null;
    MultiBackgroundHTML5PlayerWrapper.prototype.play    = function() {
        this.element.play();
    };
    MultiBackgroundHTML5PlayerWrapper.prototype.pause   = function() {
        this.element.pause();
    };
    MultiBackgroundHTML5PlayerWrapper.prototype.stop    = function() {
        this.element.pause();
        this.element.currentTime = 0;
    };
    MultiBackgroundHTML5PlayerWrapper.prototype.mute    = function() {
        this.element.volume = 0;
        this.element.muted = true;
    };
    MultiBackgroundHTML5PlayerWrapper.prototype.unMute  = function() {
        this.element.volume = 1;
        this.element.muted = false;
    };

    // Video player controls wrapper for YouTube videos
    // TODO Unit tests
    function MultiBackgroundYouTubePlayerWrapper(player) {
        MultiBackgroundYouTubePlayerWrapper.prototype.player = player;
    }
    MultiBackgroundYouTubePlayerWrapper.prototype.player    = null;
    MultiBackgroundYouTubePlayerWrapper.prototype.play      = function() {
        this.player.playVideo();
    };
    MultiBackgroundYouTubePlayerWrapper.prototype.pause     = function() {
        this.player.pauseVideo();
    };
    MultiBackgroundYouTubePlayerWrapper.prototype.stop      = function() {
        this.player.stopVideo();
    };
    MultiBackgroundYouTubePlayerWrapper.prototype.mute      = function() {
        this.player.mute();
        this.player.setVolume(0);
    };
    MultiBackgroundYouTubePlayerWrapper.prototype.unMute    = function() {
        this.player.unMute();
        this.player.setVolume(100);
    };

    // Video player controls wrapper for Vimeo videos
    // TODO Unit tests
    function MultiBackgroundVimeoPlayerWrapper(element) {
        this.element = element;
    }
    MultiBackgroundVimeoPlayerWrapper.prototype.element = null;
    MultiBackgroundVimeoPlayerWrapper.prototype.play    = function() {
        this.element.contentWindow.postMessage({"method": "play"}, "*");
    };
    MultiBackgroundVimeoPlayerWrapper.prototype.pause   = function() {
        this.element.contentWindow.postMessage({"method": "pause"}, "*");
    };
    MultiBackgroundVimeoPlayerWrapper.prototype.stop    = function() {
        this.element.contentWindow.postMessage({"method": "pause"}, "*");
    };
    MultiBackgroundVimeoPlayerWrapper.prototype.mute    = function() {
        this.element.contentWindow.postMessage({"method": "setVolume"}, 0);
    };
    MultiBackgroundVimeoPlayerWrapper.prototype.unMute  = function() {
        this.element.contentWindow.postMessage({"method": "setVolume"}, 1);
    };

    // Parses a string color representation into a usable color object
    // TODO Unit tests
    function MultiBackgroundColor(value) {
        // Value should be a parse-able string
        if("string" !== typeof value) {
            throw "Color value must be of type \"string\"";
        }
        value = value.toLowerCase();

        // #09f(f)
        var regex = new RegExp("^#([a-f0-9]{3,4})$");
        if(regex.test(value)) {
            var result = regex.exec(value);
            if(null !== result && "string" === typeof result[1]) {
                this.red        = parseInt(result[1].substring(0, 1) + result[1].substring(0, 1), 16);
                this.green      = parseInt(result[1].substring(1, 2) + result[1].substring(1, 2), 16);
                this.blue       = parseInt(result[1].substring(2, 3) + result[1].substring(2, 3), 16);
                if(4 === result[1].length) {
                    this.alpha  = parseInt(result[1].substring(3, 4) + result[1].substring(3, 4), 16);
                }
                return this;
            }
        }

        // #0099ff(ff)
        var regex = new RegExp("^#([a-f0-9]{6,8})$");
        if(regex.test(value)) {
            var result = regex.exec(value);
            if(null !== result && "string" === typeof result[1]) {
                this.red        = parseInt(result[1].substring(0, 2), 16);
                this.green      = parseInt(result[1].substring(2, 4), 16);
                this.blue       = parseInt(result[1].substring(4, 6), 16);
                if(8 === result[1].length) {
                    this.alpha  = parseInt(result[1].substring(6, 8), 16);
                }
                return this;
            }
        }

        // rgb(0, 128, 255)
        var regex = new RegExp("^\\s*rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)\\s*$");
        if(regex.test(value)) {
            var result = regex.exec(value);
            if(null !== result && "string" === typeof result[1] && "string" === typeof result[2] && "string" === typeof result[3]) {
                this.red    = parseInt(result[1], 10);
                this.green  = parseInt(result[2], 10);
                this.blue   = parseInt(result[3], 10);
                return this;
            }
        }

        // rgba(0, 128, 255, 0.5)
        var regex = new RegExp("^\\s*rgba\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\,\\s*([0-9\\.]+)\\)\\s*$");
        if(regex.test(value)) {
            var result = regex.exec(value);
            if(null !== result && "string" === typeof result[1] && "string" === typeof result[2] && "string" === typeof result[3] && "string" === typeof result[4]) {
                this.red    = parseInt(result[1], 10);
                this.green  = parseInt(result[2], 10);
                this.blue   = parseInt(result[3], 10);
                this.alpha  = Math.round(parseFloat(result[4]) * 255);
                return this;
            }
        }

        // No match
        throw "Color value could not be parsed, supported formats are: #09f, #09ff, #0099ff, #0099ffff, rgb(0, 128, 255), rgba(0, 128, 255, 0.5)";
    };
    MultiBackgroundColor.prototype.red              = 255;
    MultiBackgroundColor.prototype.green            = 255;
    MultiBackgroundColor.prototype.blue             = 255;
    MultiBackgroundColor.prototype.alpha            = 255;
    MultiBackgroundColor.prototype.getHEX           = function() {
        return "#" + (this.red < 16 ? "0" : "") + this.red.toString(16) + (this.green < 16 ? "0" : "") + this.green.toString(16) + (this.blue < 16 ? "0" : "") + this.blue.toString(16);
    };
    MultiBackgroundColor.prototype.getHEXA          = function() {
        return "#" + (this.red < 16 ? "0" : "") + this.red.toString(16) + (this.green < 16 ? "0" : "") + this.green.toString(16) + (this.blue < 16 ? "0" : "") + this.blue.toString(16) + this.alpha.toString(16) + (this.alpha < 16 ? "0" : "") + this.alpha.toString(16);
    };
    MultiBackgroundColor.prototype.getRGB   = function() {
        return "rgb(" + this.red + ", " + this.green + ", " + this.blue + ")";
    };
    MultiBackgroundColor.prototype.getRGBA          = function() {
        return "rgba(" + this.red + ", " + this.green + ", " + this.blue + ", " + (this.alpha / 255) + ")";
    };
    MultiBackgroundColor.prototype.isTranslucent    = function() {
        return this.alpha < 255;
    };

    // Default plugin option params
    $.fn.multiBackground._defaultOptions = {
        "action": "append",
        "video": {
            "width": 16,
            "height": 9,
            "autoplay": true,
            "loop": true,
            "muted": true,
            "nohtml5support": "Your browser does not support HTML5 video"
        },
        "gmap": {
            "zoom": 15,
            "language": "en"
        },
        "transitionloaded": "linear,500"
    };

    // Scroll/Resize (refresh) events
    $.fn.multiBackground._refreshEvents = {
        events: [],
        add: function(callback) {
            this.events.push(callback);
            return this;
        },
        remove: function(callback) {
            var idx = this.events.indexOf(callback);
            if(0 <= idx) {
                this.events.splice(idx, 1);
            }
            return this;
        },
        call: function() {
            for(var i in this.events) {
                this.events[i]();
            }
            return this;
        }
    };
    $(window).bind("resize scroll", function() {
        $.fn.multiBackground._refreshEvents.call();
    });
    
    // Parse and apply plugin from attributes & hidden integrators
    $(function() {
        $("[data-multibackground]").multiBackgroundFromAttributes();
        $("[data-multibackground-integrator]").multiBackgroundFromIntegrator();
    });
}(jQuery));
