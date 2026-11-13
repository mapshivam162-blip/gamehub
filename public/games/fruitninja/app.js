$(function() {
	let isPlaying = false;
	let score;
	let heartsLeft;
	let step;
	let action; // set interval function
	let fruits = ["apple", "orange", "orange2", "pineapple", "pear", "lemon", "grapes"];

	$("#startReset").click(function() {
		if(isPlaying == true) {
			// reload page
			location.reload();
		} else {
			isPlaying = true;
			$("#gameOver").hide();
			$("#score").show();
			// Set the score values to 0
			score = 0;
			$("#scorevalue").html(score);
			// Change the button text to Reset Game
			$(this).html("Reset Game!");
			// Show score box
			$("#heartsLeft").show();
			heartsLeft = 3;
			// Changing the score logic
			addHearts();
			// Start sending fruits
			startAction();
		}
	});

	$("#fruit1").on("mouseover touchstart click", function(e) {
		if (!isPlaying) return;
		if ($(this).is(":hidden")) return;
		score++;
		$("#scorevalue").html(score);
		// Play audio files
		try { $("#sliceSound")[0].play(); } catch(err) {}

		// Stop fruit
		clearInterval(action);

		// Hide the fruit
		$("#fruit1").hide("explode", 500);

		// Send new fruit
		setTimeout(startAction, 500);
	});

	// Function to add the hearts to the game
	function addHearts() {
		$("#heartsLeft").empty();
		for(let i = 0; i < heartsLeft; i++) {
			$("#heartsLeft").append(' <img src="images/heart.png" class="hearts"> ');
		}
	}

	// Fruit function
	function startAction() {

		fruitPosition();
    	
    	// Move fruit by one step every 10ms
		action = setInterval(function() {

			// Move fruit by one step
			$("#fruit1").css("top", $("#fruit1").position().top + step);

	    	// Check if fruit is too low
	    	if($("#fruit1").position().top > $("#fruitContainer").height()) {
	    		// Check if any hearts left
	    		if(heartsLeft > 1) {
	    			// Generate random fruit
					fruitPosition();
	    			// Reduce hearts by one
	    			heartsLeft --;
	    			// Populate hearts left box
	    			addHearts();
	    		} else { // Game Over
	    			isPlaying = false;
					$("#gameOver").show();
					$("#gameOver").html('<p>GAME OVER</p> <p>Your score is ' + score + ' </p>');
					$("#startReset").html("Start Game");
					$("#heartsLeft").hide();
	    			stopAction();
	    			// GameHub rewards
	    			try {
	    				const c = parseInt(localStorage.getItem('coins') || '1500', 10) + score * 2;
	    				localStorage.setItem('coins', String(c));
	    				const gp = parseInt(localStorage.getItem('games_played') || '0', 10) + 1;
	    				localStorage.setItem('games_played', String(gp));
	    				const ghBest = parseInt(localStorage.getItem('best_score') || '0', 10);
	    				if (score > ghBest) localStorage.setItem('best_score', String(score));
	    			} catch (e) {}
	    		}
	    	}
	    }, 10);
	}

	// Generate a random fruit
	function chooseFruit() {
		$("#fruit1").attr("src", "images/" + fruits[Math.round(7 * Math.random())] + ".png");
	}



	// Place fruit in random position
	function fruitPosition() {
		$("#fruit1").show();
		chooseFruit();
		$("#fruit1").css({"left" : Math.round(550 * Math.random()), "top" : -100});// Random position
		
		// Generate random step
		step = 1 + Math.round(5 * Math.random());// changing the step
	}

	// Stop dropping fruits
	function stopAction() {
		// Stopping fruits from going down
		clearInterval(action);
		// Hiding fruit
		$("#fruit1").hide();
	}


});





  // Slice fruit
  // Play sound explode fruit
  // Increase score by one
  