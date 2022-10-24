# OispaHallaLeaderboard backend

NodeJS/Express/Mongoose leaderboard backend for [OispaHalla](https://github.com/hallabois/OispaHalla)

## Contributing

Install dependencies with `yarn install` and run the server with `yarn dev`. If you want, use `yarn dev:debug` to run the server with debugging enabled on port `1234`.

Alternatively build the project with `yarn build` and run the compiled code with `yarn start`.

Please run `yarn format` before committing.

## Usage

### Environment variables

The following environment variables can be used to configure the server:

- `ADMIN_TOKEN` - Token used to authenticate admin requests, **required**
- `MONGO_URI` - [URI](https://www.mongodb.com/docs/manual/reference/connection-string/) to MongoDB database, if left blank the server will create an in-memory database with [mongodb-memory-server](https://www.npmjs.com/package/mongodb-memory-server)
- `PAPERTRAIL_SERVER` and `PAPERTRAIL_PORT` - If set, logs will be sent to [Papertrail](https://papertrailapp.com/)
- `PORT` - Defaults to `5000`

This project uses [dotenv](https://www.npmjs.com/package/dotenv) to load environment variables from a `.env` file.

---

### Routes

`GET - /alive`
Returns a 200 status code if the server is alive.

#### /scores route

Every request to the `/scores` route is in the format of `/scores/size/(size)` where the size is the board size. The size can be either `3` or `4` by default (defined in `/src/routes/scores.ts`).

`GET - /scores/size/(size)/`
Returns all scores for the given size.

`GET - /scores/size/(size)/(maxnum)` - GET
Returns the top `maxnum` scores for the given size.

`GET - /scores/size/(size)/count`
Returns the number of scores for the given size.

`GET/POST - /scores/size/(size)/token/(token?)`
Returns the score for the given size and Firebase token. The token should be in the body for a POST request, or in the query for a GET request.

`GET/POST - /scores/size/(size)/fetchboard/(maxnum)/(token?)`
Returns the top `maxnum` scores for the given size, the score for the Firebase token, and "rivals" of the user. The token should be in the body for a POST request, or in the query for a GET request. The POST request should be in the format of:

```json
{
  "token": "(token?)",
  "rankplus": (rankplus?), // represents the number of ranks above the user's rank to include (=worse scores)
  "rankminus": (rankminus?) // represents the number of ranks below the user's rank to include (= better scores)
}
```

`POST - /scores/size/(size)/`
Adds a new score to the database. The request should be in the format of:

```json
{
  "user": {
    "screnName": "(screenName)", // can be used to update the user's current name
    "token": "(token)"
  },
  "score": (score),
  "breaks": (breaks), // currently not validated since the frontend doesn't keep track of breaks, so the leaderboard uses the one returned by HAC
  "history": "(history)"
}
```

A successful request should return a 201 status code and the following body:

```json
{
  "message": "Score created successfully",
  "createdScore": (the score that has been created, including the user and hash information)
  "nameChanged": (true if the user's name has been updated, false otherwise)
}
```

---

#### /admin route

All admin requests should have the query parameter `token` set to the admin token e.g. `/admin/scores/name/jukkapekka?token=abcd`.

`GET - /admin/scores/(id/uid/name)/(value)`
Returns the user by user MongoDB _id, user Firebase uid, or username.

`GET - /admin/scores/size/id/(id)`
Returns a score by score MongoDB _id.

---

#### /meta route

`GET - /meta/verifyname/(name)/uid/(uid)`
Returns a `valid` boolean indicating whether the given name is available for the given user and if the name doesn't contain any profanity.

`POST - /meta/changename/(token?)`
Changes the user's name to the given name. The request should be in the format of:

```json
{
  "token": "(token?)",
  "name": "(name)"
}
```
