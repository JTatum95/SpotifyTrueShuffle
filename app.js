const dotenv = require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const Console = require("console");

const client_id = process.env.CLIENT_ID; // your clientId
const client_secret = process.env.CLIENT_SECRET; // Your secret
const redirect_uri = process.env.CALLBACK; // Your redirect uri

const generateRandomString = (length) => {
  return crypto
    .randomBytes(60)
    .toString('hex')
    .slice(0, length);
}

const stateKey = 'spotify_auth_state';

const app = express();

app.use(express.static(__dirname + '/public'))
  .use(cors())
  .use(cookieParser());

app.get('/login', function (req, res) {

  let state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  let scope = 'user-read-private user-read-email';
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
  let code = req.query.code || null;
  let state = req.query.state || null;
  let storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      new URLSearchParams({
        error: 'state_mismatch'
      }).toString());
  } else {
    res.clearCookie(stateKey);
    let authUrl = "https://accounts.spotify.com/api/token";
    let authData = `grant_type=authorization_code&code=${code}&redirect_uri=${redirect_uri}`;
    let authHeaders = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + (Buffer.from(`${client_id}:${client_secret}`).toString('base64'))
      }
    }

    axios.post(authUrl, authData, authHeaders).then(response => {
      if (response.status === 200) {
        let access_token = response.data.access_token,
          refresh_token = response.data.refresh_token;

        let options = {
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
  let refresh_token = req.query.refresh_token;
  let authOptions = {
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
      let access_token = response.data.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});

console.log('Listening on 8888');
app.listen(8888);
