# OispaHallaLeaderboard backend

Käyttää [nodea](https://nodejs.org), asenna se ensin.

Asenna aluksi dependencyt komennolla `npm i`. Voit käynnistää devserverin komennolla `npm run dev` (käyttää nodemonia, käynnistyy siis uudelleen jokaisella tiedostomuutoksella), tai voit suorittaa ilman nodemonia komennolla `npm run start` . 

Käyttää [dotenviä](https://www.npmjs.com/package/dotenv), jonka avulla voit luoda .env-tiedoston, joka sisältää ympäristön asetukset, kuten ADMIN_TOKEN, HTTP_PROXY ja PORT.

---

# Käyttö

### Scores

#### GET

`/scores/` - GET
Palauttaa kaikki pisteet. (Mukaanottamatta _id-arvoja)

`/scores/(maxnum)` - GET
Palauttaa takaisin top `maxnum` parhaimmat scoret. (vain nimet ja tulokset)

`/scores/count` - GET
Palauttaa pisteiden määrän.

`/scores/id/(id)` - GET
Palauttaa tuloksen annetun id:n perusteella. (mukaanottamatta historiaa)

`/scores/fetchboard/(maxnum)/(id)` - GET
Palauttaa top `maxnum` parhaimmat scoret (vain nimet ja tulokset) sekä scoren ja rankin annetun `id`:n perusteella. 


#### POST

`/scores/` - POST

Onnistunut hyväksytty POST-requesti palauttaa HTTP 201-koodin, onnistunut mutta HAC:in kieltämä requesti palauttaa HTTP 403-koodin. Requestin body on JSONilla ja sen täytyy olla muodossa:

```json
{
  "id": "61bb20e1f29196a0ad5b064f", //id-tunniste vapaaehtoinen, jos olemassa, päivitetään jo olemassa oleva score
  "screeenName": "jukka.jarnola1970",
  "score": 500,
  "breaks": 0,
  "history": "{liian pitkä tähän}"
}
```

---

### Admin

`/admin/score/(id)?token=abc` hyväksyy GET, DELETE ja PATCH requesteja. **HUOMIO: Admin-requesteihin lisää perään kysymysmerkillä token, joka on ympäristöarvo ADMIN_TOKEN**.
