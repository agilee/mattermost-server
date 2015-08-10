// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

var client = require('../utils/client.jsx');
var AsyncClient =require('../utils/async_client.jsx');
var SocketStore = require('../stores/socket_store.jsx');
var ChannelStore = require('../stores/channel_store.jsx');
var PostStore = require('../stores/post_store.jsx');
var Textbox = require('./textbox.jsx');
var MsgTyping = require('./msg_typing.jsx');
var FileUpload = require('./file_upload.jsx');
var FilePreview = require('./file_preview.jsx');

var Constants = require('../utils/constants.jsx');

module.exports = React.createClass({
    lastTime: 0,
    handleSubmit: function(e) {
        e.preventDefault();

        if (this.state.uploadsInProgress.length > 0) return;

        if (this.state.submitting) return;

        var post = {}
        post.filenames = [];

        post.message = this.state.messageText;
        if (post.message.trim().length === 0 && this.state.previews.length === 0) {
            return;
        }

        if (post.message.length > Constants.CHARACTER_LIMIT) {
            this.setState({ post_error: 'Comment length must be less than '+Constants.CHARACTER_LIMIT+' characters.' });
            return;
        }

        post.channel_id = this.props.channelId;
        post.root_id = this.props.rootId;
        post.parent_id = this.props.parentId;
        post.filenames = this.state.previews;

        this.setState({ submitting: true, limit_error: null });

        client.createPost(post, ChannelStore.getCurrent(),
            function(data) {
                PostStore.storeCommentDraft(this.props.rootId, null);
                this.setState({ messageText: '', submitting: false, post_error: null, server_error: null });
                this.clearPreviews();
                AsyncClient.getPosts(true, this.props.channelId);

                var channel = ChannelStore.get(this.props.channelId);
                var member = ChannelStore.getMember(this.props.channelId);
                member.msg_count = channel.total_msg_count;
                member.last_viewed_at = (new Date).getTime();
                ChannelStore.setChannelMember(member);

            }.bind(this),
            function(err) {
                var state = {};
                state.server_error = err.message;
                state.submitting = false;

                if (err.message === "Invalid RootId parameter") {
                    if ($('#post_deleted').length > 0) $('#post_deleted').modal('show');
                }
                else {
                    this.setState(state);
                }
            }.bind(this)
        );
    },
    commentMsgKeyPress: function(e) {
        if (e.which == 13 && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            this.refs.textbox.getDOMNode().blur();
            this.handleSubmit(e);
        }

        var t = new Date().getTime();
        if ((t - this.lastTime) > 5000) {
            SocketStore.sendMessage({channel_id: this.props.channelId, action: "typing", props: {"parent_id": this.props.rootId} });
            this.lastTime = t;
        }
    },
    handleUserInput: function(messageText) {
        var draft = PostStore.getCommentDraft(this.props.rootId);
        if (!draft) {
            draft = { previews: [], uploadsInProgress: []};
        }
        draft.message = messageText;
        PostStore.storeCommentDraft(this.props.rootId, draft);

        $(".post-right__scroll").scrollTop($(".post-right__scroll")[0].scrollHeight);
        $(".post-right__scroll").perfectScrollbar('update');
        this.setState({messageText: messageText});
    },
    handleUploadStart: function(clientIds, channel_id) {
        var draft = PostStore.getCommentDraft(this.props.rootId);
        if (!draft) {
            draft = {};
            draft['message'] = '';
            draft['uploadsInProgress'] = [];
            draft['previews'] = [];
        }

        draft['uploadsInProgress'] = draft['uploadsInProgress'].concat(clientIds);
        PostStore.storeCommentDraft(this.props.rootId, draft);

        this.setState({uploadsInProgress: draft['uploadsInProgress']});
    },
    handleFileUploadComplete: function(filenames, clientIds, channel_id) {
        var draft = PostStore.getCommentDraft(this.props.rootId);
        if (!draft) {
            draft = {};
            draft['message'] = '';
            draft['uploadsInProgress'] = [];
            draft['previews'] = [];
        }

        // remove each finished file from uploads
        for (var i = 0; i < clientIds.length; i++) {
            var index = draft['uploadsInProgress'].indexOf(clientIds[i]);

            if (index != -1) {
                draft['uploadsInProgress'].splice(index, 1);
            }
        }

        draft['previews'] = draft['previews'].concat(filenames);
        PostStore.storeCommentDraft(this.props.rootId, draft);

        this.setState({uploadsInProgress: draft['uploadsInProgress'], previews: draft['previews']});
    },
    handleUploadError: function(err, clientId) {
        var draft = PostStore.getCommentDraft(this.props.rootId);
        if (!draft) {
            draft = {};
            draft['message'] = '';
            draft['uploadsInProgress'] = [];
            draft['previews'] = [];
        }

        var index = draft['uploadsInProgress'].indexOf(clientId);
        if (index != -1) {
            draft['uploadsInProgress'].splice(index, 1);
        }

        PostStore.storeCommentDraft(this.props.rootId, draft);

        this.setState({uploadsInProgress: draft['uploadsInProgress'], server_error: err});
    },
    clearPreviews: function() {
        this.setState({previews: []});
    },
    removePreview: function(id) {
        var previews = this.state.previews;
        var uploadsInProgress = this.state.uploadsInProgress;

        // id can either be the path of an uploaded file or the client id of an in progress upload
        var index = previews.indexOf(id);
        if (index !== -1) {
            previews.splice(index, 1);
        } else {
            index = uploadsInProgress.indexOf(id);

            if (index !== -1) {
                uploadsInProgress.splice(index, 1);
                this.refs.fileUpload.cancelUpload(id);
            }
        }

        var draft = PostStore.getCommentDraft(this.props.rootId);
        if (!draft) {
            draft = { message: '', uploadsInProgress: []};
        }
        draft.previews = previews;
        draft.uploadsInProgress = uploadsInProgress;
        PostStore.storeCommentDraft(this.props.rootId, draft);

        this.setState({previews: previews, uploadsInProgress: uploadsInProgress});
    },
    getInitialState: function() {
        PostStore.clearCommentDraftUploads();

        var draft = PostStore.getCommentDraft(this.props.rootId);
        messageText = '';
        uploadsInProgress = [];
        previews = [];
        if (draft) {
            messageText = draft.message;
            uploadsInProgress = draft.uploadsInProgress;
            previews = draft.previews
        }
        return { messageText: messageText, uploadsInProgress: uploadsInProgress, previews: previews, submitting: false };
    },
    componentWillReceiveProps: function(newProps) {
        if(newProps.rootId !== this.props.rootId) {
            var draft = PostStore.getCommentDraft(newProps.rootId);
            messageText = '';
            uploadsInProgress = [];
            previews = [];
            if (draft) {
                messageText = draft.message;
                uploadsInProgress = draft.uploadsInProgress;
                previews = draft.previews
            }
            this.setState({ messageText: messageText, uploadsInProgress: uploadsInProgress, previews: previews });
        }
    },
    getFileCount: function(channel_id) {
        return this.state.previews.length + this.state.uploadsInProgress.length;
    },
    render: function() {

        var server_error = this.state.server_error ? <div className='form-group has-error'><label className='control-label'>{ this.state.server_error }</label></div> : null;
        var post_error = this.state.post_error ? <label className='control-label'>{this.state.post_error}</label> : null;

        var preview = <div/>;
        if (this.state.previews.length > 0 || this.state.uploadsInProgress.length > 0) {
            preview = (
                <FilePreview
                    files={this.state.previews}
                    onRemove={this.removePreview}
                    uploadsInProgress={this.state.uploadsInProgress} />
            );
        }

        return (
            <form onSubmit={this.handleSubmit}>
                <div className="post-create">
                    <div id={this.props.rootId} className="post-create-body comment-create-body">
                        <Textbox
                            onUserInput={this.handleUserInput}
                            onKeyPress={this.commentMsgKeyPress}
                            messageText={this.state.messageText}
                            createMessage="Add a comment..."
                            initialText=""
                            id="reply_textbox"
                            ref="textbox" />
                        <FileUpload
                            ref='fileUpload'
                            getFileCount={this.getFileCount}
                            onUploadStart={this.handleUploadStart}
                            onFileUpload={this.handleFileUploadComplete}
                            onUploadError={this.handleUploadError} />
                    </div>
                    <MsgTyping channelId={this.props.channelId} parentId={this.props.rootId}  />
                    <div className={post_error ? 'has-error' : 'post-create-footer'}>
                        <input type="button" className="btn btn-primary comment-btn pull-right" value="Add Comment" onClick={this.handleSubmit} />
                        { post_error }
                        { server_error }
                    </div>
                </div>
                { preview }
            </form>
        );
    }
});
