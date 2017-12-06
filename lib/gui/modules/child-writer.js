/*
 * Copyright 2017 resin.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict'

const ipc = require('node-ipc')
const EXIT_CODES = require('../../shared/exit-codes')
const errors = require('../../shared/errors')
const writer = require('../../cli/writer')

ipc.config.id = process.env.IPC_CLIENT_ID
ipc.config.socketRoot = process.env.IPC_SOCKET_ROOT
ipc.config.silent = false

// > If set to 0, the client will NOT try to reconnect.
// See https://github.com/RIAEvangelist/node-ipc/
//
// The purpose behind this change is for this process
// to emit a "disconnect" event as soon as the GUI
// process is closed, so we can kill this process as well.
ipc.config.stopRetrying = 0

const IPC_SERVER_ID = process.env.IPC_SERVER_ID

/**
 * @summary Send a log debug message to the IPC server
 * @function
 * @private
 *
 * @param {String} message - message
 *
 * @example
 * log('Hello world!')
 */
const log = (message) => {
  ipc.of[IPC_SERVER_ID].emit('log', message)
}

ipc.connectTo(IPC_SERVER_ID, () => {
  // The IPC server failed. Abort.
  ipc.of[IPC_SERVER_ID].on('error', () => {
    process.exit(EXIT_CODES.GENERAL_ERROR)
  })

  // The IPC server was disconnected. Abort.
  ipc.of[IPC_SERVER_ID].on('disconnect', () => {
    process.exit(EXIT_CODES.GENERAL_ERROR)
  })

  ipc.of[process.env.IPC_SERVER_ID].on('connect', () => {
    log(`Successfully connected to IPC server: ${IPC_SERVER_ID}, socket root ${ipc.config.socketRoot}`)

    writer.writeImage(process.env.OPTION_IMAGE, process.env.OPTION_DEVICE, {
      unmountOnSuccess: Boolean(process.env.OPTION_UNMOUNT),
      validateWriteOnSuccess: Boolean(process.env.OPTION_VALIDATE)
    }, (state) => {
      ipc.of[IPC_SERVER_ID].emit('state', state)
    }).then((results) => {
      ipc.of[IPC_SERVER_ID].emit('done', results)
    }).catch((error) => {
      ipc.of[IPC_SERVER_ID].emit('error', errors.toJSON(error))
    })
  })
})
