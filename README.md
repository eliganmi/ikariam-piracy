# Ikariam gusarski poeni

Minimalan kompletan primjer koji automatski čita gusarske poene i vidljivih 10 igrača dnevne rang-liste kada igrač otvori **Gusarsku tvrđavu**, dohvaća koordinate gradova i oznake saveza preko read-only Ikariam prikaza ostrva, šalje podatke na mali Node.js backend i prikazuje zadnje stanje. Backend spaja pakete rang-liste svih očitanih igrača na istom serveru, uklanja duplikate i sortira objedinjenu listu po poziciji.

## Pokretanje

Potrebno je imati Node.js 18 ili noviji. Projekat nema vanjskih paketa.

```bash
npm start
```

Otvorite `http://localhost:8787` za frontend.

Za telefone otvorite `/mobile.html` na javnoj HTTPS adresi backenda i pratite upute za dodavanje bookmarkleta. Mobilni korisnik zatim otvara Gusarsku tvrđavu i ručno pokreće spremljenu oznaku; nije potrebna browser ekstenzija. `localhost` adresa s računara nije dostupna telefonu, a HTTPS Ikariam stranica zahtijeva da i udaljeni backend koristi HTTPS.

## Učitavanje ekstenzije na računaru

1. Chrome/Edge: otvorite `chrome://extensions`, uključite Developer mode, kliknite **Load unpacked** i izaberite folder `extension/`.
2. Firefox: otvorite `about:debugging#/runtime/this-firefox`, kliknite **Load Temporary Add-on** i izaberite `extension/manifest.json`.
3. U opcijama ekstenzije ostavite `http://localhost:8787` ili unesite adresu vašeg HTTPS backenda.
4. Otvorite Ikariam i uđite u Gusarsku tvrđavu. Novi rezultat bi se trebao pojaviti na frontendu.

Za produkciju poslužite backend preko HTTPS-a i dodajte njegov origin u `host_permissions` u manifestu. Ako postavite varijablu `IKARIAM_INGEST_KEY`, unesite istu vrijednost u opcijama ekstenzije.

## Google Chrome na Android telefonu

Google Chrome na Androidu ne podržava instaliranje desktop Chrome ekstenzija, čak ni kada je uključen prikaz **Desktop site**. Zato mobilna verzija koristi bookmarklet: JavaScript kod spremljen kao obična Chrome oznaka. Korisnik otvara Gusarsku tvrđavu i ručno pokreće tu oznaku. Više informacija: [Google Chrome Web Store pomoć](https://support.google.com/chrome_webstore/answer/1698338).

Mobilni bookmarklet očitava i šalje iste podatke kao ekstenzija:

- gusarske poene prijavljenog igrača;
- server, svijet i koordinate trenutnog grada;
- do 10 trenutno vidljivih igrača dnevne rang-liste;
- njihove rang-poene, koordinate i oznake saveza, kada ih Ikariam vrati.

### Preduslovi

Backend mora biti objavljen na javnoj HTTPS adresi, na primjer:

```text
https://poeni.example.com
```

`http://localhost:8787` radi samo na računaru na kojem je backend pokrenut i nije dostupan koleginom telefonu. Obična LAN HTTP adresa također nije dovoljna jer HTTPS Ikariam stranica ne smije slati podatke prema nesigurnom HTTP backendu.

### Kreiranje mobilne oznake

1. Na telefonu otvorite javnu adresu aplikacije, dodajući `/mobile.html`, na primjer:

   ```text
   https://poeni.example.com/mobile.html
   ```

2. Ako backend koristi `IKARIAM_INGEST_KEY`, unesite isti ključ u prikazano polje. Ako ga ne koristi, ostavite polje prazno.
3. Pritisnite **Kopiraj kod**. Kopirani tekst mora počinjati sa `javascript:`.
4. U Chromeu otvorite bilo koju stranicu, pritisnite meni sa tri tačke i izaberite **Add to bookmarks**.
5. Otvorite **Bookmarks**, pronađite novu oznaku, pritisnite tri tačke pored nje i izaberite **Edit**.
6. Naziv oznake postavite na:

   ```text
   Pošalji Ikariam poene
   ```

7. Obrišite postojeću adresu oznake i u polje URL zalijepite kopirani kod.
8. Sačuvajte oznaku. Ponovo otvorite **Edit** i provjerite da URL još počinje sa `javascript:`.

### Slanje poena

1. U istom Chrome browseru prijavite se na Ikariam.
2. Otvorite grad i **Gusarsku tvrđavu** tako da su poeni i dnevna rang-lista vidljivi.
3. Dodirnite adresnu traku i upišite naziv `Pošalji Ikariam poene`.
4. U prijedlozima izaberite rezultat sa ikonom bookmarka. Nemojte izvršiti Google pretragu tog teksta.
5. Sačekajte poruku **očitavam poene, koordinate i saveze…**.
6. Kada se pojavi zelena poruka **očitano i poslano**, podaci su spremljeni. Dohvat podataka za 10 gradova može potrajati do približno 30 sekundi.
7. Otvorite glavnu adresu aplikacije da provjerite rezultat.

Za svako novo stanje ili drugi Ikariam račun ponovo otvorite Gusarsku tvrđavu i pokrenite istu oznaku. Backend uklanja uzastopne duplikate.

### Rješavanje problema na Android Chromeu

- **Chrome pokrene Google pretragu:** izaberite prijedlog sa ikonom bookmarka ili otvorite oznaku kroz Chromeov meni **Bookmarks**.
- **Ništa se ne dogodi:** provjerite kroz **Edit bookmark** da URL počinje tačno sa `javascript:` i da kod nije skraćen.
- **Poruka traži Gusarsku tvrđavu:** tvrđava ili njena rang-lista još nije učitana. Sačekajte da se prikaz potpuno otvori i ponovo pokrenite oznaku.
- **Backend nije dostupan:** provjerite da je aplikacija javno dostupna preko HTTPS-a i da je bookmarklet napravljen na toj istoj `/mobile.html` adresi.
- **Ikariam mobilni prikaz ne pokazuje cijelu tvrđavu:** u Chrome meniju privremeno uključite **Desktop site**, ponovo otvorite tvrđavu i pokrenite oznaku.
- **Nedostaju savez ili koordinate:** igrač možda nije u savezu ili Ikariam nije vratio detalje grada. Ponovite očitavanje nakon što se tvrđava potpuno učita.

Bookmarklet radi samo kada ga korisnik ručno pokrene na Ikariam domeni. Ne šalje kolačiće, lozinku, poruke niti sadržaj chata; backendu šalje samo podatke opisane iznad.

## Kako očitavanje radi

Content script se izvršava samo na `*.ikariam.gameforge.com`. Prvo potvrđuje da je otvoren prikaz gusarske tvrđave preko URL parametara, poznatih ID-eva/data atributa i lokalizovanog naslova. Zatim traži vrijednost kroz:

- stabilnije ID/data/name/aria atribute;
- stvarni Ikariam `capturePoints` element unutar `pirateFortress` prikaza;
- labela–vrijednost parove (`Gusarski poeni`, `Pirate points`, i nekoliko prijevoda);
- ograničeni tekstualni fallback unutar panela tvrđave.

Ne oslanja se na samo jednu CSS klasu. `MutationObserver`, provjera promjene URL-a u SPA interfejsu i periodična rezervna provjera pokrivaju dinamično učitavanje. Ista kombinacija servera, igrača i poena ne šalje se ponovo dok se broj ne promijeni; backend dodatno odbija uzastopni duplikat.

Za redove dnevne rang-liste `cityId` se čita iz Ikariam linka i kada je separator zapisan kao HTML entitet (`&amp;`). Taj ID se koristi za dohvat koordinata ostrva i oznake saveza.

Identitet igrača uzima se, redom, iz stabilnih data/meta atributa, linka profila i vidljivih elemenata korisničkog interfejsa. Server se dobija iz hostnamea i eventualnog world/server ID-a sa stranice. Ako ID igrača nije dostupan, koristi se ime; ne šalju se kolačići ni sadržaj chata.

## API

- `POST /api/pirate-points` — prima `{ playerId?, playerName?, server, coordinates?, points, leaderboard?, capturedAt, sourceUrl }`.
- `GET /api/pirate-points/latest` — vraća zadnji zapis po igraču.
- `GET /api/health` — health check.

Podaci se čuvaju u `backend/data/points.json`, koji se automatski kreira i nije namijenjen za commit.

## Testovi

```bash
npm test
```
