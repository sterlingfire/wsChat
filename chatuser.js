/** Functionality related to chatting. */

// Room is an abstraction of a chat channel
const Room = require("./Room");
const axios = require("axios");
/** ChatUser is a individual connection from client -> server to chat. */

class ChatUser {
  /** Make chat user: store connection-device, room.
   *
   * @param send {function} callback to send message to this user
   * @param room {Room} room user will be in
   * */

  constructor(send, roomName) {
    this._send = send; // "send" function for this user
    this.room = Room.get(roomName); // room user will be in
    this.name = null; // becomes the username of the visitor

    console.log(`created chat in ${this.room.name}`);
  }

  /** Send msgs to this client using underlying connection-send-function.
   *
   * @param data {string} message to send
   * */

  send(data) {
    try {
      this._send(data);
    } catch {
      // If trying to send to a user fails, ignore it
    }
  }

  /** Handle joining: add to room members, announce join.
   *
   * @param name {string} name to use in room
   * */

  handleJoin(name) {
    this.name = name;
    this.room.join(this);
    this.room.broadcast({
      type: "note",
      text: `${this.name} joined "${this.room.name}".`,
    });
  }

  /** Handle a chat: broadcast to room.
   *
   * @param text {string} message to send
   * */

  handleChat(text) {
    this.room.broadcast({
      name: this.name,
      type: "chat",
      text: text,
    });
  }

  /** Handle messages from client:
   *
   * @param jsonData {string} raw message data
   *
   * @example<code>
   * - {type: "join", name: username} : join
   * - {type: "chat", text: msg }     : chat
   * </code>
   */

  handleMessage(jsonData) {
    let msg = JSON.parse(jsonData);

    if (msg.type === "join") this.handleJoin(msg.name);
    else if (msg.type === "get-joke") this.handleJoke();
    else if (msg.type === "get-members") this.handleMembers();
    else if (msg.type === "name-change") this.nameChange(msg.text);
    else if (msg.type === "private-message") {
      this.handlePrivateMessage(msg.user, msg.text);
    }
    else if (msg.type === "chat") this.handleChat(msg.text);
    else throw new Error(`bad message: ${msg.type}`);
  }

  /* Handle the getting and sending of jokes */

  async handleJoke() {
    console.log("Should have sent joke.");
    let joke = await axios({
      headers: { 'Accept': 'text/plain' },
      url: `https://icanhazdadjoke.com`
    });
    joke = joke.data;
    this.send(JSON.stringify(
      {
        type: "note",
        text: `${joke}.`,
      }));
  }

  /* Change user name and braodcast this change. */
  nameChange(newName) {
    let oldName = this.name;
    this.name = newName;
    this.room.broadcast({
      type: "note",
      text: `${oldName} has changed their name to ${newName}!`
    });
  }

  /* Handle the getting and sending of members in the user's room */

  handleMembers() {
    console.log("Should have sent members.");
    let members = this.room.members.values();
    console.log('members are', members);
    let membersText = [...members].map(m => m.name).join(', ');
    this.send(JSON.stringify(
      {
        type: "note",
        text: `${membersText}`,
      }));
  }

  /* Handle the getting and sending of private messages */

  handlePrivateMessage(username, text) {
    console.log("private message.");
    let members = this.room.members;
    let toUser = [...members].find(m => m.name === username);
    this.sendPM({ toUser, username });
  }

  /* Helper method to send a private message */

  sendPM({ toUser, username }) {
    if (toUser) {
      toUser.send(JSON.stringify(
        {
          type: "note",
          text,
        }));
      this.send(JSON.stringify(
        {
          type: "note",
          text: "Message sent!"
        }
      ));
    }
    else {
      this.send(JSON.stringify(
        {
          type: "note",
          text: `No user found in room: ${username}`
        }
      ));
    }
  }
  /** Connection was closed: leave room, announce exit to others. */

  handleClose() {
    this.room.leave(this);
    this.room.broadcast({
      type: "note",
      text: `${this.name} left ${this.room.name}.`,
    });
  }
}

module.exports = ChatUser;
