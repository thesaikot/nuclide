/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {Subscription} from 'rxjs';
import type {Transport} from './Proxy';

import net from 'net';
import {getLogger} from 'log4js';

const logger = getLogger('tunnel-socket-manager');

export class SocketManager {
  _port: number;
  _transport: Transport;
  _subscription: Subscription;
  _socketByClientId: Map<number, net.Socket>;
  _tunnelId: string;

  constructor(tunnelId: string, port: number, transport: Transport) {
    this._tunnelId = tunnelId;
    this._port = port;
    this._transport = transport;
    this._socketByClientId = new Map();
  }

  receive(message: Object) {
    this._handleMessage(message);
  }

  _handleMessage(message: Object) {
    logger.trace(`handling this message: ${JSON.stringify(message)}`);
    if (message.event === 'connection') {
      this._createConnection(message);
    } else if (message.event === 'data') {
      this._forwardData(message);
    }
  }

  _createConnection(message: Object) {
    const socket = net.createConnection({port: this._port});

    socket.on('error', err => {
      logger.error(err);
    });

    socket.on('data', data => {
      this._sendMessage({
        event: 'data',
        arg: data.toString('base64'),
        clientId: message.clientId,
        tunnelId: this._tunnelId,
      });
    });

    this._socketByClientId.set(message.clientId, socket);
  }

  _forwardData(message: Object) {
    const socket = this._socketByClientId.get(message.clientId);
    if (socket != null) {
      socket.write(Buffer.from(message.arg, 'base64'));
    } else {
      logger.error('no socket found for this data: ', message);
    }
  }

  _sendMessage(msg: Object): void {
    this._transport.send(JSON.stringify(msg));
  }

  close() {
    if (this._subscription != null) {
      this._subscription.unsubscribe();
    }
    this._socketByClientId.forEach(socket => {
      socket.end();
    });
  }
}
