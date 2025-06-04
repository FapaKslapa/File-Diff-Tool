document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('fileForm');
    const resultsContainer = document.getElementById('results');
    const differencesContainer = document.getElementById('differencesContainer');
    const loadingIndicator = document.getElementById('loading');

    // Mostra esplicitamente il form all'inizio
    gsap.set('#fileForm, .form-control, .btn', {opacity: 1, visibility: 'visible'});

    // Animazioni iniziali con GSAP
    const timeline = gsap.timeline();

    // Animazione del titolo e della form
    timeline.from('h1', {
        y: -50,
        opacity: 0,
        duration: 1,
        ease: "back.out(1.7)"
    })
        .from('.card', {
            opacity: 0,
            y: 30,
            stagger: 0.2,
            duration: 0.8,
            ease: "power3.out"
        }, "-=0.5");

    // Animazione pulsanti e input - versione più veloce
    gsap.from('.form-control, .btn', {
        scale: 0.95,
        opacity: 0.5,
        stagger: 0.02,  // ridotto da 0.1 a 0.05
        duration: 0.1,  // ridotto da 0.5 a 0.3
        ease: "power1.out",  // cambio della curva di easing per accelerare
        delay: 0.3,     // ridotto da 0.8 a 0.3
        clearProps: "all"
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Animazione per il loading indicator
        gsap.fromTo(loadingIndicator,
            {opacity: 0, scale: 0.8},
            {opacity: 1, scale: 1, duration: 0.4, ease: "power2.out"}
        );
        loadingIndicator.classList.remove('hidden');
        resultsContainer.classList.add('hidden');

        const formData = new FormData(form);

        try {
            const response = await fetch('/api/compare', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                showResults(data.differences);
            } else {
                showError(data.error || 'Errore durante il confronto dei file');
            }
        } catch (error) {
            showError('Errore di connessione al server');
        } finally {
            // Animazione per nascondere il loading
            gsap.to(loadingIndicator, {
                opacity: 0,
                scale: 0.8,
                duration: 0.4,
                onComplete: () => loadingIndicator.classList.add('hidden')
            });
        }
    });

    function showResults(differences) {
        differencesContainer.innerHTML = '';

        if (differences.length === 0) {
            differencesContainer.innerHTML = '<p>I file sono identici.</p>';
        } else {
            differences.forEach((diff, index) => {
                const diffElement = document.createElement('div');
                diffElement.className = `difference ${diff.type === 'rimozione' ? 'removal' : 'addition'}`;

                // Formatta il valore e il contesto
                const formattedValue = diff.value.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
                const formattedBefore = diff.context.before.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
                const formattedAfter = diff.context.after.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');

                diffElement.innerHTML = `
                    <h3>Differenza #${index + 1}</h3>
                    <p>Tipo: ${diff.type === 'rimozione' ? 'Testo rimosso' : 'Testo aggiunto'}</p>
                    <div class="diff-content">
                        <span>${formattedBefore}</span>
                        <span class="diff-value">[${formattedValue}]</span>
                        <span>${formattedAfter}</span>
                    </div>
                `;

                diffElement.style.opacity = 0;  // Nascosto inizialmente per l'animazione
                differencesContainer.appendChild(diffElement);
            });
        }

        // Memorizziamo la posizione corrente dello scroll
        const currentScrollPos = window.scrollY;

        // Mostra il container risultati con animazione
        resultsContainer.classList.remove('hidden');
        gsap.fromTo(resultsContainer,
            {opacity: 0, y: 20},
            {
                opacity: 1, y: 0, duration: 0.6, ease: "power3.out",
                onComplete: () => {
                    // Mantieni la posizione di scroll
                    window.scrollTo(0, currentScrollPos);
                }
            }
        );

        // Anima ogni differenza con un effetto a cascata
        gsap.fromTo('.difference',
            {opacity: 0, x: -20},
            {opacity: 1, x: 0, stagger: 0.15, duration: 0.5, ease: "power2.out", delay: 0.3}
        );
    }

    function showError(message) {
        differencesContainer.innerHTML = `<p class="error">Errore: ${message}</p>`;
        resultsContainer.classList.remove('hidden');

        // Memorizziamo la posizione corrente dello scroll
        const currentScrollPos = window.scrollY;

        // Animazione per l'errore
        gsap.fromTo(resultsContainer,
            {opacity: 0, scale: 0.95},
            {
                opacity: 1, scale: 1, duration: 0.5, ease: "back.out(1.2)",
                onComplete: () => {
                    // Mantieni la posizione di scroll
                    window.scrollTo(0, currentScrollPos);
                }
            }
        );
        gsap.fromTo('.error',
            {opacity: 0, y: -10},
            {opacity: 1, y: 0, duration: 0.4, ease: "power2.out", delay: 0.2}
        );
    }
});