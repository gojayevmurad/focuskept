# Yeni SaaS-a başlamaq

## 1. Template-dən yeni layihə

GitHub-da **Use this template → Create a new repository** seç, sonra yeni repozitoriyanı klonla. Node 24 və Docker Compose tələb olunur.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm setup
```

Bu repozitoriyada pin edilmiş pnpm 11 `setup` script-ini dəstəkləyir. Parametrləri script-ə ötürərkən aşağıdakı kimi `--` ayırıcısından istifadə et (`pnpm run setup --name ...` da işləyir).

Ad, unikal slug (`invoice-kit`), təsvir, rəng, production domeni və `owner/repository` daxil et. İnteraktiv olmayan nümunə:

```sh
pnpm setup -- --name "Invoice Kit" --slug invoice-kit \
  --domain app.example.com --repository owner/invoice-kit \
  --description "Hesab-fakturaların idarəsi" --color '#7461d9'
```

Komanda brend və `saas.config.json`, lokal `.env.local`, həmçinin `deploy/generated/` daxilində production `.env`, `runtime.env` və Caddy nümunəsi yaradır. Hər layihənin lokal/production DB parolu və auth sirri ayrıdır. Production sirləri Git və Docker build kontekstinə daxil olmur. `setup` təkrar çağırıldıqda mövcud env fayllarını dəyişmir və parolları yeniləmir. Slug dəyişdirilmir; başqa SaaS üçün yeni template nüsxəsi yarat. Domen/portu sonradan dəyişirsənsə, qorunan env fayllarındakı uyğun dəyərləri də ayrıca yoxla.

## 2. Lokal inkişaf — tətbiq və baza Docker-də

```sh
pnpm local:up
pnpm local:migrate
pnpm local:logs
```

`setup` nəticəsində göstərilən localhost ünvanını aç. Mənbə kodu mount edilir, dəyişikliklər görünür. PostgreSQL datası layihəyə aid named volume-da qalır. `pnpm local:stop` yalnız konteynerləri dayandırır, datanı silmir. İstəsən yalnız bazanı Docker-də saxlayıb tətbiqi `pnpm dev` ilə də işlədə bilərsən; eyni app portunda iki rejimi paralel başlatma.

Port toqquşursa ilk setup zamanı `--port 3100 --db-port 15432 --test-db-port 15433` ver. Standart portlar slug-a görə seçilir, buna baxmayaraq onların boş olması təmin edilmir. Lokal məktubları `pnpm email:inbox` ilə gör; real məktub göndərilmir.

Yoxlamalar: `pnpm typecheck`, `pnpm lint`, `pnpm test`. İn­teqrasiya üçün `pnpm local:test-db && pnpm test:integration`; brauzer üçün Chromium quraşdır (`pnpm exec playwright install chromium`), localhost:3000-ı boşalt və `pnpm test:e2e` işlət. Testlər yalnız ayrıca `_test` bazasına yazmalıdır.

## 3. İlk production deploy — bir dəfəlik hazırlıq

**VPS üçün bir dəfə:** Docker/Compose, SSH, backup və mərkəzi Caddy-nin mövcud xarici `proxy` şəbəkəsi hazır olmalıdır. Mövcud Caddy avtomatik dəyişdirilmir.

**Hər SaaS üçün bir dəfə:**

1. GitHub `main` üçün PR/Quality qaydalarını planın imkan verdiyi qədər aktivləşdir. Setup dəyişikliklərini PR ilə merge et və Quality nəticəsini gözlə.
2. Aşağıdakı deploy rejimlərindən birini seç. GitHub variables: `DEPLOY_MODE`, `DEPLOY_PATH=/srv/saas/invoice-kit/deploy`; manual rejimdə əlavə `DEPLOY_ACTORS=github-login` (bir neçə login vergüllə). Secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`. SSH host açarını etibarlı kanaldan təsdiqlə.
3. **Actions → Production → Run workflow**, `provision_only=true` seç. Bu, cari `main` üçün uğurlu Quality-ni yoxlayıb ARM64 image-i GHCR-a göndərir, SSH deploy etmir. Run summary-dən `ghcr.io/owner/repo@sha256:...` dəyərini götür.
4. VPS-də ayrıca `/srv/saas/invoice-kit/deploy` qovluğu və bu layihəyə səlahiyyətli deploy hesabı hazırla. `deploy.sh`, `compose.production.yaml`, `deploy/generated/.env` və `deploy/generated/runtime.env` fayllarını təhlükəsiz köçür. Son iki fayla `chmod 600`, qovluğa `chmod 700` tətbiq et. Repo daxilindəki generated sirləri heç vaxt commit etmə; təhlükəsiz backup saxla.
5. Serverdə `runtime.env` üçün real Resend göndəricisi/açarı, lazım olan Polar və digər xidmətləri konfiqurasiya et. Production email yoxdursa health check uğursuz olacaq. Lokal env-ni production-a köçürmə. Serverdə GHCR üçün yalnız pull icazəli giriş qur; tokeni `--password-stdin` ilə ötür.
6. Deployment qovluğunda aşağıdakı əmrləri yerinə yetir. Migration SQL-i əvvəlcədən yoxla; mövcud data varsa backup götür.

```sh
cd /srv/saas/invoice-kit/deploy
export APP_IMAGE='ghcr.io/owner/invoice-kit@sha256:REAL_DIGEST'
docker compose --env-file .env -f compose.production.yaml pull app db
docker compose --env-file .env -f compose.production.yaml up -d --wait db
docker compose --env-file .env -f compose.production.yaml run --rm --no-deps app node scripts/migrate.cjs
bash deploy.sh "$APP_IMAGE"
```

7. Caddy sahibinin razılığı ilə generated Caddy nümunəsini mərkəzi konfiqurasiyaya əlavə et. DNS/TLS və `https://app.example.com/api/health` yoxlanmalıdır. Sonrakı tətbiq deploy-ları Caddy-yə toxunmur.

**GitHub planına uyğun qorunma:**

- `DEPLOY_MODE=protected`: `production` environment və ən azı bir real required reviewer qaydası tələb edilir. Secret-ləri həmin environment-də saxla. Uğurlu main Quality-dən sonra image yığılır, SSH deploy GitHub approval gözləyir. Workflow real reviewer qaydasını API ilə yoxlayır; imkan yoxdursa qorunmanı keçmir, dayanır. Public repozitoriyalarda bu imkan daha genişdir; private repozitoriyalarda reviewer qaydası üçün adətən Enterprise lazımdır.
- `DEPLOY_MODE=manual` (standart): reviewer funksiyası olmayan planlar üçün. Secret-lər repository səviyyəsində saxlanır. Merge avtomatik production-a çıxmır: `DEPLOY_ACTORS` siyahısındakı write icazəli şəxs **Run workflow** ilə konkret cari main versiyasını təsdiqləyir. Bu, müstəqil ikinci reviewer yoxlaması deyil. Private Free repozitoriyada environment/branch protection imkanını mövcud saymırıq.

Dəqiq imkanları repository Settings-də yoxla. [GitHub environment məhdudiyyətləri](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments). Tək developer üçün öz PR-na GitHub review approval vermək mümkün deyil; planla dəstəklənən qaydaları və manual operator təsdiqini buna uyğun seç.

## 4. Gündəlik push-to-deploy

Feature branch → PR → Quality → nəzərdən keçirilmiş merge. `protected` rejimdə uğurlu main Quality production workflow-nu başladır; image immutable digest ilə deploy edilir və environment approval tələb olunur. `manual` rejimdə bundan sonra səlahiyyətli operator **Run workflow** seçir (`provision_only=false`). Hər iki rejim cari main üçün uğurlu Quality və merged PR əlaqəsi tələb edir; birbaşa main push-u deploy üçün kifayət etmir. Cari main dəyişibsə köhnə deploy dayanır.

Routine deploy yalnız **app** konteynerini yeniləyir. Baza və volume silinmir, migration avtomatik işləmir. Schema dəyişiklikləri üçün backup + yoxlanmış, geriyə uyğun migration-ı ayrıca explicit icra et. Provision faylları dəyişərsə serverdə onları ayrıca nəzərdən keçirilmiş əməliyyatla yenilə; runtime sirlərini yenidən köçürüb əzmə.

## 5. Rollback

Serverdə layihənin deploy qovluğunda:

```sh
bash deploy.sh --rollback
```

Əvvəlki sağlam digest saxlanır. Yeni konteyner başlamasa və ya health keçməsə script əvvəlki image-i avtomatik bərpa etməyə çalışır. İlk deploy-da əvvəlki image olmur. Eyni digest-i təkrar deploy etmək rollback tarixçəsini əvəz etmir. Rollback schema/data-nı geri çevirmir; sıfır dayanma zəmanəti verilmir.

## 6. Eyni serverdə bir neçə SaaS və tipik xətalar

Hər SaaS üçün unikal **slug, Compose project, proxy alias, domain, deployment qovluğu, PostgreSQL parolu və auth secret** istifadə et. Production volume adı Compose project ilə ayrılır. Yalnız app ortaq `proxy` şəbəkəsinə qoşulur; DB öz private şəbəkəsindədir və host portu açmır. `IMAGE_REPOSITORY` başqa layihənin image-inin səhv deploy edilməsini bloklayır. Docker icazəsi olan hesab host üzərində geniş səlahiyyətə malikdir; ayrı qovluqlar sərt tenant təhlükəsizliyi yaratmır.

- **Port artıq istifadə olunur:** ilk setup-da ayrı lokal portlar seç; mövcud env avtomatik dəyişmir.
- **DB authentication failed:** işlək DB-nin parolunu sadəcə env-də dəyişmək parolu bazada dəyişmir. Əvvəlki sirləri bərpa et və ya ayrıca planlaşdırılmış rotasiya et; volume silmə.
- **Health 503:** `pnpm local:logs` və ya production Compose logs; DB bağlantısı, HTTPS APP_URL, auth secret, Resend və migration vəziyyətini yoxla.
- **No successful Quality / stale release:** cari main üçün Quality-ni düzəlt və yeni run başlat; köhnə image-i zorla ötürmə.
- **Protected mode reviewer error:** real repository planını/rule-u yoxla. Dəstəklənmirsə owner-in açıq qərarı ilə manual rejim seç; avtomatik fallback yoxdur.
- **SSH/GHCR access denied:** host key, layihə yolu, deploy hesabı və yalnız pull səlahiyyətini yoxla. Host yoxlamasını söndürmə.
- **Caddy 502:** unikal upstream alias, `proxy` üzvlüyü və app health; app portunu lazımsız yerə hosta açma.

Heç bir routine əmrdə `down -v`, volume silmə və destructive migration yoxdur. GitHub/VPS və real xarici xidmət yoxlamaları ayrıca tələb olunur.
