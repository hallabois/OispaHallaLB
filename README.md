# OispaHallaLeaderboard backend

Käyttää [nodea](https://nodejs.org), asenna se ensin.

Asenna aluksi dependencyt komennolla `npm i`. Voit käynnistää devserverin komennolla `npm run dev` (käyttää nodemonia, käynnistyy siis uudelleen jokaisella tiedostomuutoksella), tai voit käynnistää ilman nodemonia komennolla `node .` . Lisäksi `npm run dev` formatoi koodin Prettierillä, joka on asennettu dev-dependencynä.

---

# Käyttö

### Scores

`/scores/(vapaaehtoinen maxnum)` hyväksyy GET ja POST requesteja.

> GET: Jos requestissa annettiin /scores/ jälkeen maxnum, annetaan takaisin top maxnum parhaimmat scoret, muuten annetaan takaisin kaikki scoret. Onnistunut GET-requesti palauttaa HTTP 200-koodin.

> POST: Onnistunut hyväksytty POST-requesti palauttaa HTTP 201-koodin, onnistunut mutta HAC:in kieltämä requesti palauttaa HTTP 403-koodin (cry about it, I don't care). Requestin body on JSONilla ja sen täytyy olla muodossa:

```json
{
  "name": "jukka.jarnola1970",
  "score": 500,
  "breaks": 0,
  "history": "{liian pitkä tähän}"
}
```

---

### Admin

`/admin/score/(id)` hyväksyy GET, DELETE ja PATCH requesteja. **HUOMIO: Admin-requesteihin tarvitset Bearer tokenin**.

> GET: Syötä ID, saat tuloksen

> DELETE: Syötä ID, menetät tuloksen

> PATCH: Syötä ID, muutat tulosta

Onnistuneet admin-requestit palauttavat HTTP 200-koodin
