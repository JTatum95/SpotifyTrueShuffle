/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/documentation/web-api/tutorials/code-flow
 */

var dotenv = require('dotenv').config();
var express = require('express');
var axios = require('axios');
var crypto = require('crypto');
var cors = require('cors');
var cookieParser = require('cookie-parser');
const Console = require("console");

var client_id = process.env.CLIENT_ID; // your clientId
var client_secret = process.env.CLIENT_SECRET; // Your secret
var redirect_uri = process.env.CALLBACK; // Your redirect uri

const generateRandomString = (length) => {
  return crypto
    .randomBytes(60)
    .toString('hex')
    .slice(0, length);
}

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
  .use(cors())
  .use(cookieParser());

app.get('/login', function (req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email';
  res.redirect('https://accounts.spotify.com/authorize?' +
    new URLSearchParams({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }).toString());
});

app.get('/callback', function (req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter
  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      new URLSearchParams({
        error: 'state_mismatch'
      }).toString());
  } else {
    res.clearCookie(stateKey);
    var authUrl = "https://accounts.spotify.com/api/token";
    var authData = `grant_type=authorization_code&code=${code}&redirect_uri=${redirect_uri}`;
    var authHeaders = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (Buffer.from(`${client_id}:${client_secret}`).toString('base64'))
      }
    }

    axios.post(authUrl, authData, authHeaders).then(response => {
      if (response.status === 200) {
        var access_token = response.data.access_token,
          refresh_token = response.data.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: {'Authorization': 'Bearer ' + access_token},
          json: true
        };

        // use the access token to access the Spotify Web API
        axios.get(options.url, options).then(response => {
          console.log(response.data);
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          new URLSearchParams({
            access_token: access_token,
            refresh_token: refresh_token
          }).toString());
      } else {
        res.redirect('/#' +
          new URLSearchParams({
            error: 'invalid_token'
          }).toString());
      }
    }).catch(error => {
      console.log(`Error: ${error}`)
      res.redirect('/#' +
        new URLSearchParams({
          error: 'invalid_token'
        }).toString());
    });
  }
});

app.get('/refresh_token', function (req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {'Authorization': 'Basic ' + (Buffer.from(`${client_id}:${client_secret}`).toString('base64'))},
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  axios.post(authOptions.url,
    'grant_type=refresh_token&refresh_token=' + refresh_token,
    {
      headers: {
        'Authorization': 'Basic ' + (Buffer.from(`${client_id}:${client_secret}`).toString('base64'))
      }
    }
  ).then(response => {
    if (response.status === 200) {
      var access_token = response.data.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

console.log('Listening on 8888');
app.listen(8888);
