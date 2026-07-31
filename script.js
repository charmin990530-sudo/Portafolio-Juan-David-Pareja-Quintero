const formContacto = document.getElementById('form-contacto');

if (formContacto) {
    formContacto.addEventListener('submit', (evento) => {
        evento.preventDefault();
        window.location.href = 'gracias.html';
    })
}

const carrusel = document.getElementById('carrusel');
const btnAnterior = document.getElementById('btn-anterior');
const btnSiguiente = document.getElementById('btn-siguiente');

if (carrusel && btnAnterior && btnSiguiente) {
    const distanciaScroll = 300;

    btnSiguiente.addEventListener('click', () => {
        carrusel.scrollBy({ left: distanciaScroll, behavior: 'smooth' });
    });

    btnAnterior.addEventListener('click', () => {
        carrusel.scrollBy({ left: -distanciaScroll, behavior: 'smooth' });
    });
}

const tarjetasProyecto = document.querySelectorAll('.proyecto');

tarjetasProyecto.forEach(tarjeta => {
    tarjeta.addEventListener('mousemove', (evento) => {
        const rect = tarjeta.getBoundingClientRect();
        const x = evento.clientX - rect.left;
        const y = evento.clientY - rect.top;

        const centroX = rect.width / 2;
        const centroY = rect.height / 2;

        const rotarX = ((y - centroY) / centroY) * -8;
        const rotarY = ((x - centroX) / centroX) * 8;

        tarjeta.style.transform =
            `perspective(1000px) rotateX(${rotarX}deg) rotateY(${rotarY}deg) scale(1.03)`;
    });

    tarjeta.addEventListener('mouseleave', () => {
        tarjeta.style.transform =
            'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
    });
});

const botonTema = document.getElementById('toggle-tema');

if (botonTema) {
    const temaGuardado = localStorage.getItem('tema');
    if (temaGuardado === 'oscuro') {
        document.body.classList.add('oscuro');
        botonTema.textContent = '☀️';
    }

    botonTema.addEventListener('click', () => {
        document.body.classList.toggle('oscuro');
        const esOscuro = document.body.classList.contains('oscuro');
        botonTema.textContent = esOscuro ? '☀️' : '🌙';
        localStorage.setItem('tema', esOscuro ? 'oscuro' : 'claro');
    });
}
const nombreHero = document.querySelector('#inicio h2');

if (nombreHero) {
    const texto = nombreHero.textContent;
    nombreHero.innerHTML = '';

    texto.split('').forEach(letra => {
        const span = document.createElement('span');
        span.className = 'letra-interactiva';
        span.textContent = letra === ' ' ? '\u00A0' : letra;
        nombreHero.appendChild(span);
    });
}

const logoHeader = document.querySelector('.logo h1');

if (logoHeader) {
    const frases = ['Juan David Pareja Quintero', 'Desarrollador Web Full Stack'];
    let indiceFrase = 0;
    let indiceLetra = 0;
    let borrando = false;

    function escribirRotativo() {
        const fraseActual = frases[indiceFrase];

        if (!borrando) {
            logoHeader.textContent = fraseActual.substring(0, indiceLetra + 1);
            indiceLetra++;

            if (indiceLetra === fraseActual.length) {
                borrando = true;
                setTimeout(escribirRotativo, 1800);
                return;
            }
        } else {
            logoHeader.textContent = fraseActual.substring(0, indiceLetra - 1);
            indiceLetra--;

            if (indiceLetra === 0) {
                borrando = false;
                indiceFrase = (indiceFrase + 1) % frases.length;
            }
        }

        const velocidad = borrando ? 40 : 80;
        setTimeout(escribirRotativo, velocidad);
    }

    escribirRotativo();
}
const secciones = document.querySelectorAll('main section[id]');
const enlacesNav = document.querySelectorAll('nav a[href*="#"]');

if (secciones.length && enlacesNav.length) {
    const observerNav = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                enlacesNav.forEach(enlace => enlace.classList.remove('activo'));
                const enlaceActivo = document.querySelector(`nav a[href$="#${entry.target.id}"]`);
                if (enlaceActivo) enlaceActivo.classList.add('activo');
            }
        });
    }, { threshold: 0.5 });

    secciones.forEach(seccion => observerNav.observe(seccion));
}

const seccionesFade = document.querySelectorAll('#sobre-mi, #habilidades, #proyectos, #contacto');
if (seccionesFade.length) {
    const observerFade = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.2 });

    seccionesFade.forEach(seccion => {
        seccion.classList.add('oculto');
        observerFade.observe(seccion);
    });
}

const botonArriba = document.createElement('button');
botonArriba.id = 'volver-arriba';
botonArriba.textContent = '↑';
botonArriba.setAttribute('aria-label', 'Volver arriba');
document.body.appendChild(botonArriba);

window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
        botonArriba.classList.add('visible');
    } else {
        botonArriba.classList.remove('visible');
    }
});

botonArriba.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

const barraProgreso = document.createElement('div');
barraProgreso.id = 'barra-progreso';
document.body.appendChild(barraProgreso);

window.addEventListener('scroll', () => {
    const alturaTotal = document.documentElement.scrollHeight - window.innerHeight;
    const progreso = (window.scrollY / alturaTotal) * 100;
    barraProgreso.style.width = progreso + '%';
});
const barrasHabilidad = document.querySelectorAll('.barra-relleno');
if (barrasHabilidad.length) {
    const observerBarras = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const relleno = entry.target;
                relleno.style.width = relleno.dataset.nivel + '%';
                observerBarras.unobserve(relleno);
            }
        });
    }, { threshold: 0.5 });

    barrasHabilidad.forEach(barra => observerBarras.observe(barra));
}
