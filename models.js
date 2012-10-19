var serverside = false;
if (typeof(require) != 'undefined')
	serverside = true;

// serverside code
if (serverside) {
	var db = require('./database.js');
	var now = require('./sutils').now;
	var Backbone = require('backbone');
	var crypto = require('crypto');
	var names = require('./names.js');
	Backbone.sync = function(method, model, options){
		switch(method) {
			case 'create': db.create(model, options); break;
			case 'read': 
				if (model.attributes)
					db.read(model, options);
				else db.read_all(model, options);
				break;
			case 'update': db.update(model, options); break;
			case 'delete': db.delete(model, options); break;
		}
	}
}

var models = {};

models.Video = Backbone.Model.extend({
	db_fields: ['queue_id', 'prev', 'next', 'url', 'time'],
	defaults: {
		queue_id: 0,
		prev: 0,
		next: 0,
		url: '00000000000',
		time: 0,
		thumb: '',
		title: '',
		uploader: '',
		time_text: '0:00'
	},
	initialize: function() {
		this.classname = 'video';
		if (serverside && !this.id && this.get('hash')) {
			var md5 = crypto.createHash('md5');
			md5.update(''+Math.random());
			this.set('id',md5.digest('hex'));
		}
		if (!serverside && this.get('url') != '00000000000') {
			var url = this.get('url');
			var infourl = 'http://gdata.youtube.com/feeds/api/videos/'+url+'?v=2&alt=json';
			var self = this;
			$.get(infourl, function(data){
				var seconds = parseInt(data.entry.media$group.yt$duration.seconds);
				var minutes = Math.floor(seconds/60);
				var mod_seconds = seconds%60;
				self.set({
					title: data.entry.title.$t,
					uploader: data.entry.author[0].name.$t,
					time: seconds,
					thumb: data.entry.media$group.media$thumbnail[0].url,
					time_text: minutes+':'+mod_seconds
				});
			});
		}
	},
	verify: function() {
		var url = this.get('url');
		// todo -- santify the url charset
		if (typeof(url) != 'string' || url.length != 11)
			return false;
		return true;
	}
});

models.VideoList = Backbone.Collection.extend({
	model: models.Video,
	initialize: function() {
		var self = this;
		this.classname = 'video';
	},
	after: function(video) {
		var nextid = video.get('next');
		if (nextid) return this.get(nextid);
		else return this.at(0);
	}
});

models.Player = Backbone.Model.extend({
	defaults: {
		state: 'paused',
		current: new models.Video(),
		time: 0
	},
	play: function(){
		this.set('state', 'playing');
		this.trigger('action');
	},
	pause: function(){
		this.set('state', 'paused');
		this.trigger('action');
	},
	initialize: function() {
		var self = this;
		this.start_ticker();
	},
	start_ticker: function() {
		var self = this;
		setInterval(function(){ self.tick(); }, 1000);
	},
	tick: function() {
		if (!this.get('current')) return;
		var time = this.get('time');
		if (this.get('state') == 'playing')
			time += 1;
		if (time <= this.get('current').get('time')) {
			this.set({'time': time}, {silent: true});
			return;
		} else {
			this.trigger('end');
		}
	},
	set_vid: function(video) {
		this.set({
			time: 0,
			current: video,
			state: 'playing'
		});
	},
	seek: function(time) {
		var vidlength = this.get('current').get('time');
		if (time < vidlength)
			this.set('time', time);
		else this.set('time', vidlength);
		this.trigger('action');
	}
});

models.Message = Backbone.Model.extend({
	defaults: {
		author: 0,
		content: '',
		time: 0,
		rendered: false
	},
	initialize: function() {
		if (!this.id) {
			var md5 = crypto.createHash('md5');
			md5.update(''+Math.random());
			this.set('id',md5.digest('hex'));
		}
	}
});

models.MessageList = Backbone.Collection.extend({
	model: models.Message
})

models.User = Backbone.Model.extend({
	defaults: {
		username: '', 
		avatar_url: '/static/avatars/newfoal.png'
	},
	initialize: function(){
		this.classname = 'user';
		if (!this.id && serverside) {
			var md5 = crypto.createHash('md5');
			md5.update(''+Math.random());
			this.set('id',md5.digest('hex'));
		}
		if (!this.get('username') && serverside)
			this.set('username',names.gen_name());
	}
});

models.UserList = Backbone.Collection.extend({
	model: models.User,
	initialize: function() {
		this.classname = 'user';
	}
});

models.Room = Backbone.Model.extend({
	defaults: {
		userlist: new models.UserList(),
		queue: new models.VideoList(),
		playlist: new models.VideoList(),
		player: new models.Player(),
		mutelist: new models.UserList(),
		modlist: new models.UserList(),
		owner: new models.User,
		messages: new models.MessageList(),
		current: new models.Video()
	},
	initialize: function() {
		this.classname = 'room';
		var self = this;
		var count = 0;
		this.bind('change', function(){
			self.update();
		});

		// userlists
		if (serverside) {
			var modlist = new Backbone.Collection();
			modlist.classname = 'mod';
			modlist.query = 'room_id='+this.id;
			modlist.fetch();
			modlist.bind('reset', function(){
				modlist.each(function(modlink){
					var user = new models.User({
						id: modlink.get('user_id')
					});
					user.fetch();
					self.get('modlist').add(user);
				});
			});
		}

		// player
		var player = this.get('player');
		var playlist = this.get('playlist');

		playlist.on('reset', function(){
			if (self.get('current').get('time')) return;
			self.set('current', playlist.at(0));
		});
		player.on('end', function(){
			var curr = self.get('current');
			self.set('current', playlist.after(curr));
		});

		playlist.on('selected', function(video){
			self.set('current', video);
		});
		this.on('play', function(video){

		});
		this.on('play', function(video){
			
		});
		this.on('play', function(video){
			
		});

		this.on('change:current', function(){
			player.set_vid(self.get('current'));
		});
		this.update();
	},
	update: function() {
		var self = this;
		if (serverside) {
			self.get('playlist').query = 'queue_id='+this.get('queue_id');
			self.get('playlist').fetch();
			self.get('playlist').id = this.get('queue_id');
			self.get('owner').id = this.get('owner_id');
			self.get('owner').fetch();
		}
	},
	join: function(user){
		this.get('userlist').add(user);
	},
	leave: function(user) {
		this.get('userlist').remove(user.id);
	},
	message: function(user, new_message) {
		if (!this.get('userlist').get(user.id)) return;
		if (this.get('mutelist').get(user.id)) return;
		else {
			var messages = this.get('messages');
			if (messages.length >= 100)
				messages.reset();
			messages.add(new_message);
		}
	},
	mute: function(mod, user, mute) {
		if (!this.get('modlist').get(mod.id)) return;
		if (!this.get('userlist').get(user.id)) return;
		if (mute)
			this.get('mutelist').add(user);
		else this.get('mutelist').remove(user);
	},
	mod: function(admin, user, mod) {
		if (this.get('owner').id != admin.id) return;
		if (!this.get('userlist').get(user.id)) return;
		if (mod)
			this.get('modlist').add(user);
		else this.get('modlist').remove(user);
	},
	json: function() {
		var json = this.toJSON();
		json['messages'] = [];
		return json;
	}
});

models.RoomList = Backbone.Collection.extend({
	model: models.Room,
	initialize: function() {
		this.classname = 'room'
	}
});

if (serverside) {
	module.exports = models;
}
