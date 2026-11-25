# StudyShelf

**Find free books to study from, then test yourself with quick quizzes.**

Many students can't afford textbooks and don't know where to find legal free copies.
StudyShelf searches millions of books on Open Library and shows the ones you can
**read online for free right now**, lets you save them to a reading list, and then
lets you check what you learned with practice quizzes on the same subject.

- **Live site (through the load balancer):** https://www.enzoasaph.tech/studyshelf/
- **Demo video:** https://youtu.be/BIBmRCh62EY

---

## Features

### 1. Free Book Finder
- Search by **anything, title, author or subject**, or click a quick topic (Calculus, Biology, Programming...)
- **Free to read online only** filter (on by default) so you only see books you can actually open
- **Sort** by relevance, newest, oldest, title A-Z or most editions
- **Filter** the loaded results by language or by a word in the title/author
- Each book shows its cover, author, year, editions, subjects and a clear badge:
  *Free to read*, *Free to borrow* or *Info only*
- **Read now** opens the full book on the Internet Archive
- **Load more** button for more results
- **Reading list**: save books and find them again later (stored in your browser)

### 2. Quiz Practice
- Choose a **subject** (Mathematics, Computers, Science, History, Geography...), **difficulty**,
  **number of questions** and **question type** (multiple choice / true-false)
- Shows how many questions exist for the chosen subject
- One question at a time with a progress bar, instant right/wrong feedback and the correct answer
- Results page with your score, a message, and a **review of every answer**
  (with a filter to show only the ones you got wrong)
- **"Find free books on this subject"** button sends you straight to the book finder
- **Quiz history** table with average and best score, **sortable** by clicking any column

### 3. Error handling
| Problem | What the user sees |
|---|---|
| No internet | "You seem to be offline..." |
| API too slow (20 s) | "The server took too long to answer..." |
| API down / HTTP error | "Could not reach the server..." or "The server returned an error (500)..." |
| Too many requests (HTTP 429 or quiz code 5) | "Too many requests. Please wait..." |
| Bad / unreadable data | "The server sent back data we could not read." |
| No results | Suggests another word or turning off the free-only filter |
| Not enough quiz questions (code 1) | Suggests fewer questions or another difficulty |
| Search term too short | "Please type at least 2 characters..." |

The page never crashes: every API call is wrapped in `try/catch`, and a failed subject list
still lets you start a quiz on "Any subject".

### 4. Extras (bonus)
- **Caching:** API answers are kept in memory for 10 minutes so repeating a search is instant
  and doesn't hit the API again (`js/helpers.js`).
- **Security:** every piece of text from an API goes through `escapeHTML()` before it is shown,
  which blocks cross-site scripting (XSS). User input is trimmed, length-limited and URL-encoded.
  Nginx adds `X-Content-Type-Options` and `X-Frame-Options` headers. The site runs on HTTPS.
- **Rate limit respect:** the Start button waits 5 seconds between quizzes because Open Trivia DB
  allows one request every 5 seconds.

---

## APIs used

| API | What it is used for | Docs | Key needed? |
|---|---|---|---|
| Open Library Search API | Searching books, covers, free-to-read status | https://openlibrary.org/dev/docs/api/search | No |
| Open Library Covers API | Book cover images | https://openlibrary.org/dev/docs/api/covers | No |
| Open Trivia Database | Quiz subjects, question counts and questions | https://opentdb.com/api_config.php | No |

**API keys:** none are needed. Both APIs are free and public, so there is no secret in the code
or in this repository. The `.gitignore` still blocks `.env` and key files in case a key is added later.

Endpoints called:
- `https://openlibrary.org/search.json?q=...&sort=...&page=...&fields=...`
- `https://covers.openlibrary.org/b/id/<cover_id>-M.jpg`
- `https://opentdb.com/api_category.php`
- `https://opentdb.com/api_count.php?category=<id>`
- `https://opentdb.com/api.php?amount=10&category=<id>&difficulty=easy&type=multiple&encode=url3986`

---

## Run it locally

The app is plain HTML, CSS and JavaScript, so there is nothing to install.

1. Clone the repository
   ```bash
   git clone https://github.com/EnzoAsaph/studyshelf.git
   cd studyshelf
   ```
2. Start any simple web server in the folder, for example:
   ```bash
   python3 -m http.server 8000
   ```
   (or use the **Live Server** extension in VS Code)
3. Open http://localhost:8000 in your browser.

---

## Deployment

### Servers
| Server | IP | Role |
|---|---|---|
| web-01 | 3.82.203.173 | Nginx web server |
| web-02 | 13.221.226.57 | Nginx web server |
| lb-01 | 3.87.222.148 | HAProxy load balancer (HTTPS) |

Domain: `enzoasaph.tech` (`www` points to lb-01).

### Step 1 - Put the app on web-01 and web-02
Run the script from the project folder (Git Bash / Linux / macOS):
```bash
./deploy/deploy.sh ~/.ssh/id_rsa
```
For each web server the script:
1. copies `index.html`, `css/` and `js/` to `/tmp/studyshelf`,
2. moves them to `/var/www/studyshelf` and gives them to the `www-data` user,
3. checks the Nginx config (`nginx -t`) and reloads Nginx,
4. calls `http://<server-ip>/studyshelf/` to make sure it answers `200`.

Manual way (same thing):
```bash
scp -r index.html css js ubuntu@3.82.203.173:/tmp/studyshelf/
ssh ubuntu@3.82.203.173
sudo mkdir -p /var/www/studyshelf
sudo cp -r /tmp/studyshelf/* /var/www/studyshelf/
```

### Step 2 - Configure Nginx (both web servers, done once)
Add the block from [`deploy/nginx-studyshelf.conf`](deploy/nginx-studyshelf.conf) inside the
`server { ... }` block of `/etc/nginx/sites-available/default`:
```nginx
location /studyshelf/ {
    alias /var/www/studyshelf/;
    index index.html;
    try_files $uri $uri/ /studyshelf/index.html;
    add_header X-Served-By $hostname;
}
```
Then:
```bash
sudo nginx -t
sudo systemctl reload nginx
```
`X-Served-By` puts the server's name in every response, which lets us see which server answered.

### Step 3 - Configure the load balancer (lb-01)
HAProxy on lb-01 receives all traffic for `www.enzoasaph.tech`, handles HTTPS with a
Let's Encrypt certificate and shares requests between the two web servers with **round robin**.
The relevant part of `/etc/haproxy/haproxy.cfg` is in [`deploy/haproxy.cfg`](deploy/haproxy.cfg):
```
backend web-backend
    balance roundrobin
    server web-01 3.82.203.173:80 check
    server web-02 13.221.226.57:80 check
```
- `balance roundrobin` sends request 1 to web-01, request 2 to web-02, and so on.
- `check` makes HAProxy test each server; if one goes down, all traffic goes to the other one.
- Port 80 redirects to HTTPS (port 443).

After editing: `sudo haproxy -c -f /etc/haproxy/haproxy.cfg && sudo systemctl restart haproxy`

### Step 4 - Test the load balancer
```bash
for i in 1 2 3 4; do curl -sI https://www.enzoasaph.tech/studyshelf/ | grep -i x-served-by; done
```
The answer switches between web-01 and web-02, which shows the traffic is balanced.
Both servers return the same page, so the user gets the same app whichever server answers.

---

## Project structure
```
studyshelf/
├── index.html            # page layout (3 tabs)
├── css/style.css         # styles, responsive for phones
├── js/helpers.js         # fetch with timeout + cache, error messages, XSS escaping, storage
├── js/books.js           # free book finder (Open Library)
├── js/quiz.js            # quiz practice + history (Open Trivia DB)
├── js/main.js            # tab switching, starts the app
├── deploy/deploy.sh      # copies the app to web-01 and web-02
├── deploy/nginx-studyshelf.conf
├── deploy/haproxy.cfg
└── .gitignore
```

---

## Challenges and how I solved them

1. **Too many books that are not really free.** Open Library returns every book, even ones you
   can only buy. Filtering in the browser left very few results. I found that the search API
   accepts `ebook_access:public` inside the query, so the API itself only returns free books
   and the total count is correct.
2. **Strange characters in quiz questions.** Open Trivia DB sends text like `&quot;` and `&#039;`.
   I asked for `encode=url3986` and decode with `decodeURIComponent`, then escape the text
   before showing it, so quotes look right and no HTML from the API can run.
3. **Quiz API rate limit.** Clicking Start twice quickly gave an error (response code 5).
   I show a clear message for every response code and disable the Start button for 5 seconds.
4. **Slow API answers.** Open Library is sometimes slow, so the page looked frozen. I added a
   "Searching..." message, a 20-second timeout with a clear message, and a 10-minute cache.
5. **Serving under a sub-path on the servers.** The servers already host other pages at `/`,
   so the app lives at `/studyshelf/`. I used only relative paths (`css/style.css`) so the
   same files work locally and on the servers, and used Nginx `alias`.

---

## Credits
- [Open Library](https://openlibrary.org/developers/api) by the Internet Archive - book data, covers and free e-books.
- [Internet Archive](https://archive.org/) - hosts the free books that open with "Read now".
- [Open Trivia Database](https://opentdb.com/) by PIXELTAIL GAMES LLC - quiz questions,
  licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- [Nginx](https://nginx.org/), [HAProxy](https://www.haproxy.org/) and
  [Let's Encrypt](https://letsencrypt.org/) for the deployment.
- [MDN Web Docs](https://developer.mozilla.org/) for `fetch`, `AbortController` and `localStorage`.

## Author
Enzo Asaph - [GitHub @EnzoAsaph](https://github.com/EnzoAsaph)
