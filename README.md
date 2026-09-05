# Ikariam gusarski poeni

Minimalan kompletan primjer koji automatski čita gusarske poene i vidljivih 10 igrača dnevne rang-liste kada igrač otvori **Gusarsku tvrđavu**, dohvaća koordinate gradova i oznake saveza preko read-only Ikariam prikaza ostrva, šalje podatke na mali Node.js backend i prikazuje zadnje stanje. Backend spaja pakete rang-liste svih očitanih igrača na istom serveru, uklanja duplikate i sortira objedinjenu listu po poziciji.

## Pokretanje

Potrebno je imati Node.js 18 ili noviji. Projekat nema vanjskih paketa.

```bash
npm start
```

Otvorite `http://localhost:8787` za frontend.

## Učitavanje ekstenzije

1. Chrome/Edge: otvorite `chrome://extensions`, uključite Developer mode, kliknite **Load unpacked** i izaberite folder `extension/`.
2. Firefox: otvorite `about:debugging#/runtime/this-firefox`, kliknite **Load Temporary Add-on** i izaberite `extension/manifest.json`.
3. U opcijama ekstenzije ostavite `http://localhost:8787` ili unesite adresu vašeg HTTPS backenda.
4. Otvorite Ikariam i uđite u Gusarsku tvrđavu. Novi rezultat bi se trebao pojaviti na frontendu.

Za produkciju poslužite backend preko HTTPS-a i dodajte njegov origin u `host_permissions` u manifestu. Ako postavite varijablu `IKARIAM_INGEST_KEY`, unesite istu vrijednost u opcijama ekstenzije.

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
