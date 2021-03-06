// todo -- this is really bad code, refactor

var ChatView = Backbone.View.extend({
	initialize: function() {
		var self = this;
		var messages = this.model.get('messages');
		messages.bind('add', function(){
			var unrendered = room.get('messages').where(
				{rendered: false});
			$.each(unrendered, function(idx, msg){
				self.message(msg);
				msg.set('rendered', true);
			});
		});
		var log = this.$el.find('#messages');
		room.bind('status', function(msg){
			var status = $('<div id="status">');
			status.html(msg);
			log.append(status);
			log.scrollTop(log[0].scrollHeight);
			self.options.status = true;
		});
	},
	message: function(msg) {
		var log = this.$el.find('#messages');
		var mv = this.last_message_view;
		if (this.options.status || !mv || !mv.append(msg)) {
			var mv = new MessageView({
				model: msg });
			mv.render();
			log.append(mv.el);
			this.last_message_view = mv;
		}
		var log = $('#messages');
		log.scrollTop(log[0].scrollHeight);
		this.options.status = false;
	},
	render: function() {
		var room = this.model, el = this.$el, self = this;
		el.find('#mouth #avatar img').attr('src', window.user.avatar());
		var input = el.find('#mouth #input input');
		input.keydown(function(event){
			if (event.keyCode != 13) return;
			if (input.val() == '/clear') {
				self.last_message_view = null;
				el.find('#messages').html('');
			}
			else if (input.val() == '/help' ||
				input.val() == '/list' || 
				input.val() == '/commands') {
				room.trigger('status', '/clear to clear screen, > to greentext, # to spoilertext');
			}
			else room.trigger('message', input.val());
			input.val('');
		})
	}
});

var MessageView = Backbone.View.extend({
	initialize: function(){
		if (!this.model) return;
		var content = this.model.get('content');
		if (is_img_link(content)) {
			this.options.url = content;
			this.options.thumbnail = content;
		}
		else if (is_yt_link(content)) {
			var vidid = get_yt_vidid(content);
			this.options.video = new models.Video({
				url: vidid });
			this.options.video.bind('change', this.render, this);
			this.options.url = 'http://youtube.com/watch?v='+vidid;
			this.options.thumbnail = get_yt_thumbnail(vidid);
		}
	},
	media: function(message) {
		var content = message.get('content');
		return is_img_link(content) || 
			is_yt_link(content);
	},
	append: function(message){
		if (this.options.thumbnail) return false;
		if (this.media(message)) return false;
		if (message.get('author') != this.model.get('author'))
			return false;
		if (!this.options.appendum) this.options.appendum = [];
		this.options.appendum.push(message);
		this.render();
		return true;
	},
	render: function(){
		var content = $('<div>');
		var divline = $('<div>').text(this.model.get('content'));
		var log = $('#messages');
		if (islink(this.model.get('content')))
			divline = $('<a target="_blank">').text(this.model.get('content')).attr('href',this.model.get('content'));
		content.append(divline);
		if (this.model.get('content')[0] == '>')
			divline.css('color','green');
		if (this.model.get('content')[0] == '#') {
			divline.css('color','black');
			divline.css('background-color','black');
			divline.css('cursor','pointer');
			divline.click(function(){
				$(this).css('background-color','');
			});
		}
		
		var el = this.$el, self = this;
		var avatar = '/static/avatars/sleep.png', username = 'Offline User';
		if (window.room) {
			var user = room.get('userlist').get(this.model.get('author'));
			if (user) {
				avatar = user.avatar();
				username = user.get('username');
			}
		}
		
		if (this.options.appendum)
			$.each(this.options.appendum, function(idx, msg){
				var divline = $('<div>').text(msg.get('content'));
				if (islink(msg.get('content')))
					divline = $('<a target="_blank">').text(msg.get('content')).attr('href',msg.get('content'));
				if (msg.get('content')[0] == '>')
					divline.css('color','green');
				if (msg.get('content')[0] == '#') {
					divline.css('color','black');
					divline.css('background-color','black');
					divline.css('cursor','pointer');
					divline.click(function(){
						$(this).css('background-color','');
						$(this).css('cursor','');
					});
				}
				content.append(divline);
			});

		if (this.options.thumbnail && this.options.url) {
			if (this.options.video) {
				el.html(_.template($('script#video_msg').html(),{
					avatar: avatar,
					username: username,
					content: content,
					url: this.options.url,
					thumb: this.options.thumbnail,
					title: this.options.video.get('title'),
					uploader: this.options.video.get('uploader'),
					time_text: this.options.video.get('time_text')
				}));
				if (ismod(window.user)) {
					el.find('#play').click(function(){
						window.room.trigger('play_new', self.options.video);
					});
					el.find('#queue').click(function(){
						window.room.trigger('queue', self.options.video);
					});
					el.find('#playlist').click(function(){
						window.room.trigger('playlist', self.options.video);
					});
				} else {
					el.find('#play, #queue, #playlist').remove();
				}
			}
			else {
				el.html(_.template($('script#image_msg').html(),{
					avatar: avatar,
					username: username,
					content: content,
					url: add_pretext(this.options.url),
					thumb: add_pretext(this.options.thumbnail)
				}));
				var image = new Image();
				image.onload = function(){ 
					if (image.width > 1000 || image.height > 1000) {
						el.find('#content a').html(content.append(' (too large to display)'));
						return;
					}
					el.find('#content a').empty().append(image);
					$(image).attr('id','image_thumb');
					log.scrollTop(log[0].scrollHeight);
				};
				image.onerror = function(){ el.find('#content a').html(content); };
				image.src = add_pretext(this.options.url);
			}
		} else {
			if (avatar == el.find('.avatar img').attr('src') && 
				username == el.find('#username').html()) {
				el.find('#content').html(content);
			} else
				el.html(_.template($('script#message').html(),{
					avatar: avatar,
					username: username,
					content: ''
				}));
				el.find('#content').append(content);
		}

		var img = el.find('img');
		var log = $('#messages');
		if (img){
			$.each(img, function(idx, img){
				$(img).load(function(){
					log.scrollTop(log[0].scrollHeight);
				})
			})
		}
	}
})