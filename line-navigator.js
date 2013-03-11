/*
 * Copyright (c) 2013 Miguel Castillo.
 *
 * Licensed under MIT
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */


(function() {


  /**
  *  Register lineNavigator.  Currently, this is a logic for document type.
  *  But, what the plan to use the innerMode to adjust lineNavigation based
  *  on the type of data we are dealing with.  For example, markup can be
  *  processed differently than clike languages
  */
  CodeMirror.defineOption("lineNavigator", true, lineNavigatorRegister);


  /**
  * Function to wire up instances of CodeMirror with instances of lineNavigator
  * Key events are per instance of CodeMirror...  This is primarily the driver
  * for having multiple instances of lineNavigator.  CodeMirror commands are
  * global, so there is no need for lineNavigator instances there.
  */
  function lineNavigatorRegister(cm, val, old) {

    // Register new lineNavigator instance if we need one...
    if ( val === true && !(cm._lineNavigator instanceof lineNavigator) ) {
      cm._lineNavigator = new lineNavigator(cm);
      cm._lineNavigator.register();
    }
    // Destroy the lineNavigator
    else if ( val === false && cm._lineNavigator instanceof lineNavigator ) {
      cm._lineNavigator.unregister();
      delete cm._lineNavigator;
    }


    if (!lineNavigatorRegister.registerGlobal){
      // Take over the old word navigation system so that functionality that
      // depends on word navigation can behave the same accross code mirror.
      CodeMirror.commands.goWordLeft = CodeMirror.commands.goWordBoundaryLeft = lineNavigator.navigateLineLeft;
      CodeMirror.commands.goWordRight = CodeMirror.commands.goWordBoundaryRight = lineNavigator.navigateLineRight;

	  // Add scrollLineUp and scrollLineDown as commands in code mirror
	  CodeMirror.commands.scrollLineUp = lineNavigator.scrollLineUp;
	  CodeMirror.commands.scrollLineDown = lineNavigator.scrollLineDown;

      lineNavigatorRegister.registerGlobal = true;

      /* I don't have an event to register with in order to restore the
      *  global commands in code mirror...
      // Restore the old word navigation system
      CodeMirror.commands.goWordLeft = cmCmd._goWordLeft;
      CodeMirror.commands.goWordRight = cmCmd._goWordRight;
      CodeMirror.commands.goWordBoundaryLeft = cmCmd._goWordBoundaryLeft;
      CodeMirror.commands.goWordBoundaryRight = cmCmd._goWordBoundaryRight;
      */
    }

    return cm._lineNavigator;
  }


  /**
  * @constructor
  */
  function lineNavigator(cm) {
    this.cm = cm;
  }


  lineNavigator.prototype.register = function() {
    // Register key events
    this.cm.addKeyMap({
      name: "lineNavigator",
      "Ctrl-Down": lineNavigator.scrollLineDown,
      "Ctrl-Up": lineNavigator.scrollLineUp
    });
  }


  lineNavigator.prototype.unregister = function() {
    // Unregister key events
    this.cm.removeKeyMap("lineNavigator");
  }


  lineNavigator.direction = {
    "left": {
      charCmd: "goCharLeft"
    },
    "right": {
      charCmd: "goCharRight"
    }
  };


  lineNavigator.scrollLineUp = function (cm) {
    var pos = cm.getCursor(), line = cm.lineInfo(pos.line);
    var scrollInfo = cm.getScrollInfo();
    var lineFromFirstLine = Math.round((scrollInfo.top + scrollInfo.clientHeight)/line.handle.height);
    cm.scrollTo(0, scrollInfo.top - line.handle.height);

    // A little fuzzy math here to conpensate for lines above and below...
    if ( lineFromFirstLine < pos.line + 3 ){
      cm.setCursor(lineFromFirstLine - 3, 0);
    }
  }


  lineNavigator.scrollLineDown = function (cm) {
    var pos = cm.getCursor(), line = cm.lineInfo(pos.line);
    var scrollInfo = cm.getScrollInfo();
    var lineFromFirstLine = Math.round(scrollInfo.top/line.handle.height);
    cm.scrollTo(0, scrollInfo.top + line.handle.height);

    if ( lineFromFirstLine >= pos.line ){
      cm.setCursor(lineFromFirstLine + 1, 0);
    }
  }


  /**
  *  Line Navigation logic.  There are some parts that have been extracted out of
  *  the implementation to goWordLeft and goWordRight.
  */
  lineNavigator.navigateLineRight = function (cm) {
    var dir = {
      left: lineNavigator.direction.left,
      right: lineNavigator.direction.right
    };

    var currPos = { line: -1 }, line;
    var characters = new charHandlers();

    for (;;) {
      var pos = cm.getCursor();

      // We need to check if navigating to the next character has made the cursor
      // go to the next line so that we can adjust our pos marker and get the new
      // line for processing.
      if ( currPos.line !== pos.line ){
        line = cm.getLine(pos.line);
        currPos = pos;
      }

      var _char = line[pos.ch];
      var _handler = characters.getHandler(_char);

      // If we have a white, we will simply go to the next character...
      if ( _handler.type === "space" ) {
      }
      else if (_handler.type === "empty" ) {
        // This empty handler is rather important because this is where
        // we can adjust the behavior of how to skip lines...

        // Exiting when we have read a non white space character gives us
        // a very smooth nagivation skipping all dead space.
        // Notepad++ behaves similar to this.
        if ( characters.handlers.delimeter.count || characters.handlers.character.count ) {
            break;
        }

        // If you just blindly move and exit, then the cursor will
        // stop at every empty line.  Which is a very common behavior
        // for editors like eclipse, visual studio and sublime.
        //cm.execCommand(dir.charCmd);
        //break;
      }
      else if ( _handler.type === "delimeter" ) {
        // We only exit if we have seen any characters...
        if ( characters.handlers.character.count || characters.handlers.space.count ) {
          break;
        }
      }
      else if ( _handler.type === "character" ) {
        // We exit if we have seen a delimeter or a whitespace or an empty line
        if ( characters.handlers.delimeter.count || characters.handlers.space.count || characters.handlers.empty.count ) {
          break;
        }
      }

      cm.execCommand(dir.right.charCmd);
    }
  }



  lineNavigator.navigateLineLeft = function (cm) {
    var dir = {
      left: lineNavigator.direction.left,
      right: lineNavigator.direction.right
    };

    var currPos = { line: -1 }, line;
    var characters = new charHandlers();

    for (;;) {
      cm.execCommand(dir.left.charCmd);

      var pos = cm.getCursor();

      // We need to check if navigating to the next character has made the cursor
      // go to the next line so that we can adjust our pos marker and get the new
      // line for processing.
      if ( currPos.line !== pos.line ){
        line = cm.getLine(pos.line);
        currPos = pos;
      }

      var _char = line[pos.ch];
      var _handler = characters.getHandler(_char);

      if ( _handler.type === "space" ) {
        // We only exit if we have seen any characters...
        if ( characters.handlers.character.count || characters.handlers.delimeter.count ) {
          cm.execCommand(dir.right.charCmd);
          break;
        }
      }
      else if (_handler.type === "empty" ) {
      }
      else if ( _handler.type === "delimeter" ) {
        // We only exit if we have seen any characters...
        if ( characters.handlers.character.count ) {
          cm.execCommand(dir.right.charCmd);
          break;
        }
      }
      else if ( _handler.type === "character" ) {
        if ( characters.handlers.delimeter.count ) {
          cm.execCommand(dir.right.charCmd);
          break;
        }
      }
    }
  }


  function charHandlers() {
    this.handlers = {
      empty: {
        count: 0,
        type: 'empty',
        is: charTest.empty.test
      },
      space: {
        count: 0,
        type: 'space',
        is: charTest.whiteSpace.test
      },
      delimeter: {
        count: 0,
        type: 'delimeter',
        is: charTest.delimeter.test
      },
      character: {
        count: 0,
        type: 'character',
        is: charTest.wordChar.test
      }
    };
  }


  charHandlers.prototype.getHandler = function (str) {
    for ( var handler in this.handlers ) {
      var _handler = this.handlers[handler];
      if ( _handler.is(str) ) {
        _handler.count++;
        return _handler;
      }
    }

    return this.handlers.delimeter;
  }


  //
  // Tester functions...
  //
  var charTest = {
    empty: {
      test: function(str){
        str = str || "";
        return str.length === 0;
      }
    },
    whiteSpace: {
      _regex: /[\s\t\r\n\v]/,
      test: function(str) {
        return charTest.whiteSpace._regex.test(str);
      }
    },
    delimeter: {
      _regex: /[.:;(){}\/\"',+\-*&%=<>!?|~^]/,
      test: function(str) {
        return charTest.delimeter._regex.test(str);
      }
    },
    wordChar: {
      test: function(str) {
        return isWordChar(str);
      }
    }
  };



  /** Directly from codemirror.js */
  var nonASCIISingleCaseWordChar = /[\u3040-\u309f\u30a0-\u30ff\u3400-\u4db5\u4e00-\u9fcc]/;
  function isWordChar(ch) {
    return /\w/.test(ch) || ch > "\x80" &&
      (ch.toUpperCase() != ch.toLowerCase() || nonASCIISingleCaseWordChar.test(ch));
  }


})();
