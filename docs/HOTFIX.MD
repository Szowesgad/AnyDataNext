
Plan Naprawy z Uwzględnieniem Dynamicznego Pobierania Modeli z ./v1/models

## Punkt 1: Kruche Parsowanie Danych Wejściowych (articles.py)

Problem: Parsery oparte na sztywnych regexach w articles.py są podatne na błędy przy niewielkich zmianach w formacie plików wejściowych (np. artykułów).
Naprawa:
Zamiast polegać wyłącznie na regexach, należałoby zbadać i zaimplementować bardziej odporne metody parsowania dokumentów. Na przykład:
Dla PDF i DOCX: Intensywne testy z różnorodnymi plikami i dopracowanie logiki opartej na bibliotekach pdfminer.six i python-docx, koncentrując się na ekstrakcji struktury (nagłówki, akapity) zamiast tylko tekstu i szukania sztywnych wzorców.
Dla plików tekstowych (TXT, MD) o złożonej strukturze: Rozważenie bibliotek do parsowania Markdown lub bardziej zaawansowanych technik segmentacji tekstu opartych na heurystykach lub nawet małych modelach ML wytrenowanych do identyfikacji sekcji.
Implementacja solidniejszej obsługi błędów w parserach, która nie przerywa całego procesu, gdy jeden plik ma nieoczekiwany format, ale loguje problem i przechodzi do następnego pliku.
Podział Pracy: To zadanie należy głównie do Osoby 1 (Ekspert od Danych i Logiki Przetwarzania), która zajmuje się skryptami i parserami (backend/app/scripts/, backend/app/utils/parsers.py).
Związek z modelem LLM: Bezpośrednio niewielki. Poprawne parsowanie wejściowe jest warunkiem wstępnym do stworzenia sensownego promptu dla LLM, niezależnie od tego, jaki model zostanie użyty.

## Punkt 2: Kruche Parsowanie Odpowiedzi LLM

Problem: Parsowanie odpowiedzi LLM za pomocą regexów lub prostego .split('\n') jest nietrwałe i podatne na drobne odchylenia w formacie odpowiedzi modelu.
Naprawa:
Ulepszenie Strategii Parsowania Odpowiedzi LLM:
Jeśli docelowy model LLM (pobierany dynamicznie z ./v1/models) wspiera zwracanie odpowiedzi w formacie JSON (wiele nowoczesnych modeli to potrafi), należy zmodyfikować prompty, aby explicitly poprosić o output w JSON i następnie użyć json.loads() do sparsowania odpowiedzi. To znacznie bardziej niezawodne niż regexy.
Jeśli model nie wspiera JSON output lub struktura odpowiedzi jest zbyt prosta, aby uzasadniać JSON: Zamiast sztywnych regexów, użyć bardziej elastycznych technik parsowania tekstu, które mogą tolerować niewielkie różnice w formatowaniu, lub zaimplementować logikę "retry" z delikatnie zmodyfikowanymi promptami, jeśli pierwsze parsowanie się nie powiedzie.
Standaryzacja Formatów Promptu i Parsowania: Zdefiniować wspólne wzorce dla promptów (proszenie o konkretny format) i logiki parsowania odpowiedzi we wszystkich skryptach LLM-owych (articles.py, dictionary.py, standard.py, translate.py, przyszłe skrypty).
Podział Pracy: To zadanie należy do Osoby 1 (Ekspert od Danych i Logiki Przetwarzania), ponieważ dotyczy logiki w skryptach przetwarzających. Wszelkie zmiany w ogólnych wzorcach promptów lub technikach parsowania powinny być konsultowane, zwłaszcza jeśli wpływają na moduł utils.client.
Związek z modelem LLM (Nowa Zasada): Kluczowy! Logika parsowania odpowiedzi LLM musi być świadoma, jaki model został użyty (ponieważ różne modele mogą mieć subtelnie różne preferencje co do formatowania odpowiedzi, nawet gdy proszone o to samo). Idealnie, logika parsowania powinna być na tyle elastyczna, aby działać z formatem odpowiedzi z każdego modelu dostępnego pod ./v1/models i wybranego przez użytkownika. Ostatecznie, to utils.client (Osoba 2) dostarczy informację o tym, jaki model został użyty.

## Punkt 3: Niedokończone/Wyłączone Równoległe Przetwarzanie LLM

Problem: Wywołania do LLM są wykonywane sekwencyjnie, co powoduje, że przetwarzanie dużych datasetów jest bardzo wolne.
Naprawa:
Naprawa i Włączenie parallel_process: Zdiagnozować, dlaczego funkcja parallel_process w utils/ była zakomentowana lub nie działała poprawnie. Najprawdopodobniej problem dotyczy zarządzania wątkami/procesami i bezpiecznego wywoływania funkcji (potencjalnie asynchronicznych, jeśli klient LLM jest asynchroniczny) w puli wykonawców. Należy to naprawić i włączyć jej użycie we wszystkich skryptach, gdzie wywołania LLM są czasochłonne i mogą być wykonywane równolegle (articles.py, dictionary.py, standard.py, translate.py).
Obsługa Ograniczeń Rate Limiting API: Równoległe wywoływanie LLM może szybko napotkać limity liczby żądań na minutę (rate limiting) narzucone przez dostawcę API. Należy zaimplementować mechanizm obsługi tych limitów w parallel_process lub w kliencie LLM (utils.client), np. poprzez retries z wykładniczym opóźnieniem (exponential backoff) lub ograniczenie liczby równoległych żądań wysyłanych do danego API w danym momencie.
Podział Pracy: To zadanie wymaga ścisłej współpracy. Osoba 2 (Architekt API i Systemów) powinna być odpowiedzialna za implementację samej funkcji parallel_process w utils/ i mechanizmów zarządzania limitami API (np. w utils.client), ponieważ dotyczy to zarządzania zasobami i komunikacją sieciową. Osoba 1 (Ekspert od Danych i Logiki Przetwarzania) będzie odpowiedzialna za użycie tej funkcji w swoich skryptach, upewniając się, że poprawnie przekazuje dane i odbiera wyniki.
Związek z modelem LLM (Nowa Zasada): Istotny! Limity API (rate limiting) mogą różnić się w zależności od modelu i dostawcy (OpenAI, Anthropic, Twój endpoint ./v1/models). Klient LLM w utils.client lub mechanizm zarządzania równoległością musi być w stanie dynamicznie dostosować się do limitów narzucanych przez wybranego, aktualnie używanego dostawcę/model, o czym powinien dowiedzieć się, być może, z informacji zwrotnej od API lub z metadanych dostępnych poprzez ./v1/models (choć to drugie mniej prawdopodobne).

## Punkt 4: Implementacja Klienta LLM (utils.client.py)

Problem: Moduł utils.client.py nie jest widoczny i jego poprawność jest nieznana. Jest to krytyczny punkt integracji z LLM.
Naprawa:
Implementacja/Refaktoryzacja utils.client.py:
Funkcja get_llm_client musi być zaimplementowana lub poprawiona, aby poprawnie tworzyć instancje klientów dla wszystkich obsługiwanych dostawców (Anthropic, OpenAI) i, co najważniejsze, dla Twojego własnego endpointu zgodnego z OpenAI na libraxis.cloud/v1/....
W przypadku Twojego endpointu, klient powinien używać podanego api_key i kierować żądania do właściwego adresu (https://libraxis.cloud/v1/...).
Klient powinien obsługiwać wywoływanie endpointu ./v1/models w celu pobrania listy dostępnych modeli dla danego dostawcy API. Ta lista powinna być przechowywana i udostępniana (np. cachowana).
Klient powinien radzić sobie z typowymi błędami API (np. błędy autoryzacji, błędy rate limiting, błędy serwera API) i zgłaszać je w sposób, który nadrzędna logika (np. parallel_process, handler błędów w FastAPI) potrafi obsłużyć.
Rozważenie, czy klient powinien być asynchroniczny (oparty na asyncio i httpx lub aiohttp), aby nie blokować głównej pętli zdarzeń FastAPI podczas oczekiwania na odpowiedzi LLM. Jeśli tak, parallel_process musi również wspierać asynchroniczne zadania.
Podział Pracy: To jest główny obszar odpowiedzialności Osoby 2 (Architekt API i Systemów). Osoba 1 będzie używać funkcji get_llm_client i metod zwracanego klienta, ale implementacja szczegółów komunikacji i dynamicznego pobierania modeli należy do Osoby 2.
Związek z modelem LLM (Nowa Zasada): Rdzeń tego punktu. Klient LLM musi dynamicznie pobierać listę modeli z ./v1/models. Zamiast przyjmować model_name jako sztywny argument do get_llm_client, funkcja ta może potrzebować metody do listowania dostępnych modeli po zainicjowaniu klienta dla danego dostawcy. Skrypty (Osoba 1) będą musiały najpierw pobrać listę modeli, a następnie wybrać jeden (lub użyć domyślnego) do użycia w wywołaniach client.generate().

## Punkt 5: Niedokończone/Brakujące Funkcjonalności

Problem: Nie wszystkie planowane funkcjonalności (np. audio/video processing, nowe parsery, API REST) są zaimplementowane.
Naprawa:
Systematyczna implementacja pozostałych funkcji zgodnie z priorytetami (np. z devstage.md).
Dla każdej nowej funkcjonalności:
Projektowanie logiki (Osoba 1 - np. nowy skrypt, parser, logika w utils).
Integracja z API (Osoba 2 - nowy endpoint w app.py, obsługa parametrów, Background Task, WebSocket).
Wykorzystanie istniejących i naprawionych mechanizmów (parsery, klient LLM, równoległość, raportowanie postępu).
Podział Pracy: To jest podstawowy podział pracy dla rozwoju. Nowe funkcjonalności będą wymagały współpracy obu osób zgodnie z ich rolami: Osoba 1 implementuje logikę przetwarzania, Osoba 2 integruje ją z resztą backendu (API, zadania w tle, WS).


## Punkt 6: Brak Pełnej Obsługi Błędów i Logowania w Skryptach

Problem: Obsługa błędów w skryptach może być niewystarczająca, a logowanie może nie dostarczać wystarczających informacji do diagnozy problemów.
Naprawa:
Ulepszenie Bloków try...except: Zapewnienie, że bloki try...except w skryptach i modułach utils/ są bardziej granularne i przechwytują specyficzne typy wyjątków (np. FileNotFoundError, json.JSONDecodeError, specyficzne wyjątki z bibliotek parsowania, wyjątki z klienta API LLM).
Standaryzowane Logowanie Błędów: Użycie modułu logging (skonfigurowanego w utils.logging przez Osobę 2) do rejestrowania szczegółowych informacji o błędach, w tym tracebaków, danych wejściowych, które spowodowały problem, i kontekstu (np. przetwarzany plik, id zadania).
Przekazywanie Informacji o Błędach w Zadaniu: Zmodyfikowanie funkcji convert i process_... w skryptach, aby w przypadku błędu zwracały nie tylko informację o statystykach, ale także flagę informującą o niepowodzeniu i ewentualnie komunikat błędu lub ID błędu w logach. Nadrzędna logika w app.py (Background Task, WebSocket) powinna być w stanie odebrać tę informację i poprawnie zgłosić błąd klientowi (np. przez WebSocket, zmieniając status zadania).
Podział Pracy: Odpowiedzialność za implementację logowania (utils.logging) i globalne handlery błędów w FastAPI (app.py) spoczywa na Osobie 2. Odpowiedzialność za użycie logowania, granularną obsługę błędów w logice skryptów i zwracanie informacji o błędach z funkcji przetwarzających spoczywa na Osobie 1. Wymagana ścisła współpraca, aby upewnić się, że system raportowania błędów działa spójnie od skryptów po API.

## Podsumowując:

Implementacja dynamicznego pobierania modeli z ./v1/models staje się kluczowym elementem w punkcie 4 (Implementacja Klienta LLM) i ma wpływ na punkty 2 i 3, ponieważ logika parsowania odpowiedzi i zarządzania równoległością może potrzebować informacji o aktualnie używanym modelu/dostawcy.

Poprawienie tych błędów wymaga systematycznej pracy w przydzielonych obszarach, ścisłej współpracy w kluczowych modułach utils/ i punktach styku API<->skrypty, a także konsekwentnego stosowania nowych zasad (dynamiczne modele LLM, poprawiona obsługa błędów, włączone równoległe przetwarzanie). Nowy zespół ma solidną architekturę, ale wymaga dopracowania szczegółów implementacyjnych i utwardzenia kodu.




