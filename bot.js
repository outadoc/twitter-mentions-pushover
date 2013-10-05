/* outa[bot] // app.js
	Copyright (c) 2012-2013 outa[dev].
*/

(function() {
	//the twitter api module
	var ntwitter = require('ntwitter'),
		request = require('request'),
		LogUtils = require('./lib/LogUtils.js'),

		//the username. not set to begin with, we'll get it when authenticating
		twitterUsername = null,

		//get the config (API keys, etc.)
		config = require('./config.json'),

		//create an object using the keys we just determined
		twitterAPI = new ntwitter(config.keys.twitter);
	
	//check if we have the rights to do anything
	twitterAPI.verifyCredentials(function(error, userdata) {
		if (error) {
			//if we don't, we'd better stop here anyway
			LogUtils.logtrace(error, LogUtils.Colors.RED);
			process.exit(1);
		} else {
			//the credentials check returns the username, so we can store it here
			twitterUsername = userdata.screen_name;
			LogUtils.logtrace("logged in as [" + userdata.screen_name + "]", LogUtils.Colors.CYAN);

			//start listening to tweets that contain the bot's username using the streaming api
			initStreaming();
		}
	});

	//this is called when streaming begins
	function streamCallback(stream) {
		LogUtils.logtrace("streaming", LogUtils.Colors.CYAN);

		//when we're receiving something
		stream.on('data', function(data) {
			//if it's actually there
			if(data.text !== undefined) {
				//a few checks to see if we should reply
				if(data.user.screen_name.toLowerCase() != twitterUsername.toLowerCase() 			//if it wasn't sent by the bot itself
					&& data.text.toLowerCase().indexOf('@' + twitterUsername.toLowerCase()) != -1 	//if it's really mentionning us (it should)
					&& data.retweeted_status === undefined) {										//and if it isn't a retweet of one of our tweets

					LogUtils.logtrace("[" + data.id_str + "] @mention from [" + data.user.screen_name + "]", LogUtils.Colors.GREEN);
					
					request.post(
					    'https://api.pushover.net/1/messages.json',
					    {
					    	form: {
					    		token: config.keys.pushover.api_token,
					    		user: config.keys.pushover.user_key,
					    		title: "Mention from " + data.user.screen_name,
					    		message: data.text,
					    		timestamp: (new Date()).getTime()
					    	}
					    },
					    function (error, response, body) {
					        if(error || response.statusCode != 200) {
					            LogUtils.logtrace(response.statusCode + ':' + error);
					        }
					    }
					);
				}
			}
		});
		
		//if something happens, call the onStreamError function
		stream.on('end', onStreamError);
		stream.on('error', onStreamError);

		//automatically disconnect every 30 minutes (more or less) to reset the stream
		setTimeout(stream.destroy, 1000 * 60 * 30);
	}

	function onStreamError(e) {
		//when the stream is disconnected, connect again
		if(!e.code) e.code = "unknown";
		LogUtils.logtrace("streaming ended (" + e.code + ")", LogUtils.Colors.RED);
		setTimeout(initStreaming, 5000);
	}

	function initStreaming() {
		//initialize the stream and everything else
		twitterAPI.stream('user', { with:'followings', track:'@' + twitterUsername }, streamCallback);
	}

})();