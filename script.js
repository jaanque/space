// Configuración de Spotify
const clientId = '97d973ea484b40d592cbf2e18ca5fd5c'; // Reemplaza con tu Client ID de Spotify
const redirectUri = window.location.origin + window.location.pathname;
const scope = 'user-top-read user-read-private user-read-email';

// Almacenamiento de datos
let userProfileData = null;
let topArtists = [];
let topTracks = [];

// Elementos DOM
const loginScreen = document.getElementById('login-screen');
const museumScreen = document.getElementById('museum-screen');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const shareButton = document.getElementById('share-button');
const shareModal = document.getElementById('share-modal');
const closeModal = document.querySelector('.close-modal');
const downloadButton = document.getElementById('download-button');
const collageContainer = document.getElementById('collage-container');
const shareImageContainer = document.getElementById('share-image-container');

// Asegurarse de que el modal esté oculto inicialmente
shareModal.classList.add('hidden');

// Funciones de autenticación
function generateRandomString(length) {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let text = '';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

function getHashParams() {
    const hashParams = {};
    const r = /([^&;=]+)=?([^&;]*)/g;
    const q = window.location.hash.substring(1);
    let e;
    while ((e = r.exec(q))) {
        hashParams[e[1]] = decodeURIComponent(e[2]);
    }
    return hashParams;
}

function login() {
    const state = generateRandomString(16);
    localStorage.setItem('spotify_auth_state', state);

    const authorizeUrl = 'https://accounts.spotify.com/authorize?' +
        'response_type=token' +
        '&client_id=' + encodeURIComponent(clientId) +
        '&scope=' + encodeURIComponent(scope) +
        '&redirect_uri=' + encodeURIComponent(redirectUri) +
        '&state=' + encodeURIComponent(state);

    window.location = authorizeUrl;
}

function logout() {
    localStorage.removeItem('spotify_access_token');
    localStorage.removeItem('spotify_auth_state');
    window.location.hash = '';
    showLoginScreen();
}

// Funciones de API de Spotify
async function fetchUserProfile(token) {
    const response = await fetch('https://api.spotify.com/v1/me', {
        headers: { 'Authorization': 'Bearer ' + token }
    });
    return await response.json();
}

async function fetchTopItems(token, type, limit = 50) {
    // Reducir el límite para móviles para mejorar el rendimiento
    const deviceLimit = window.innerWidth < 480 ? 20 : limit;
    
    const response = await fetch(`https://api.spotify.com/v1/me/top/${type}?limit=${deviceLimit}&time_range=medium_term`, {
        headers: { 'Authorization': 'Bearer ' + token }
    });
    return await response.json();
}

// Funciones de UI
function showLoginScreen() {
    loginScreen.classList.remove('hidden');
    museumScreen.classList.add('hidden');
    // Asegurar que el modal esté oculto al mostrar la pantalla de login
    shareModal.classList.add('hidden');
}

function showMuseumScreen() {
    loginScreen.classList.add('hidden');
    museumScreen.classList.remove('hidden');
    // Asegurar que el modal esté oculto al mostrar la pantalla del museo
    shareModal.classList.add('hidden');
}

function createCollage() {
    collageContainer.innerHTML = '';
    
    // Combinar artistas y canciones
    const allItems = [];
    
    topArtists.forEach(artist => {
        if (artist.images && artist.images.length) {
            allItems.push({
                name: artist.name,
                type: 'artist',
                imageUrl: artist.images[0].url
            });
        }
    });
    
    topTracks.forEach(track => {
        if (track.album && track.album.images && track.album.images.length) {
            allItems.push({
                name: track.name,
                type: 'track',
                imageUrl: track.album.images[0].url
            });
        }
    });
    
    // Mezclar aleatoriamente
    allItems.sort(() => Math.random() - 0.5);
    
    // Limitar el número de elementos para móviles
    const maxItems = window.innerWidth < 480 ? 24 : allItems.length;
    const displayItems = allItems.slice(0, maxItems);
    
    // Crear elementos en el DOM
    displayItems.forEach((item, index) => {
        const img = document.createElement('img');
        img.src = item.imageUrl;
        img.alt = item.name;
        img.title = item.name;
        img.className = 'album-cover';
        
        // Asignar tamaños diferentes para algunas imágenes (menos en móviles)
        if (window.innerWidth > 480 && index % 5 === 0) {
            img.style.gridColumn = 'span 2';
            img.style.gridRow = 'span 2';
        } else if (window.innerWidth <= 480 && index % 8 === 0) {
            // En móviles, menos imágenes grandes
            img.style.gridColumn = 'span 2';
            img.style.gridRow = 'span 2';
        }
        
        collageContainer.appendChild(img);
    });
}

// Función modificada para generar una imagen compartible y permitir su descarga
function generateShareImage() {
    // Mostrar mensaje de carga
    shareImageContainer.innerHTML = '<p>Preparando imagen...</p>';
    
    try {
        // Vamos a crear una versión compacta del collage para móviles
        shareImageContainer.innerHTML = '';
        
        // Contenedor principal - con ID para html2canvas
        const shareView = document.createElement('div');
        shareView.id = 'capture-this';
        shareView.style.width = '100%';
        shareView.style.margin = '0 auto';
        shareView.style.backgroundColor = '#282828';
        shareView.style.padding = '10px';
        shareView.style.borderRadius = '8px';
        
        // Título
        const title = document.createElement('h2');
        title.textContent = 'Mi Museo Musical';
        title.style.fontSize = '1.3rem';
        title.style.color = '#1DB954';
        title.style.margin = '5px 0';
        title.style.textAlign = 'center';
        shareView.appendChild(title);
        
        // Crear el marco del museo (optimizado para móviles)
        const museumFrame = document.createElement('div');
        museumFrame.style.width = '100%';
        museumFrame.style.backgroundColor = '#333';
        museumFrame.style.border = '8px solid #8B4513';
        museumFrame.style.borderRadius = '2px';
        museumFrame.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
        museumFrame.style.padding = '3px';
        museumFrame.style.position = 'relative';
        
        // Grid para las imágenes (tamaño reducido para móviles)
        const grid = document.createElement('div');
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(45px, 1fr))';
        grid.style.gridAutoRows = '45px';
        grid.style.gridAutoFlow = 'dense';
        grid.style.gap = '2px';
        grid.style.width = '100%';
        grid.style.height = '250px'; // Altura reducida para móviles
        grid.style.overflow = 'hidden';
        
        // Seleccionar imágenes para el collage (menos para móviles)
        const originalImages = collageContainer.querySelectorAll('img');
        const imageLimit = Math.min(originalImages.length, 16); // Reducir para móviles
        
        // Solo usar las primeras imageLimit imágenes
        for (let i = 0; i < imageLimit; i++) {
            const originalImg = originalImages[i];
            const img = document.createElement('img');
            img.src = originalImg.src;
            img.alt = originalImg.alt;
            img.title = originalImg.title;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            
            // Copiar estilo span pero solo para algunas imágenes
            if (i % 5 === 0) {
                img.style.gridColumn = 'span 2';
                img.style.gridRow = 'span 2';
            }
            
            const imgContainer = document.createElement('div');
            imgContainer.style.position = 'relative';
            imgContainer.appendChild(img);
            grid.appendChild(imgContainer);
        }
        
        museumFrame.appendChild(grid);
        shareView.appendChild(museumFrame);
        
        // Pie de página
        const footer = document.createElement('p');
        footer.textContent = 'nam3.es';
        footer.style.fontSize = '0.9rem';
        footer.style.margin = '5px 0 0';
        footer.style.textAlign = 'center';
        shareView.appendChild(footer);
        
        // Añadir la vista completa al contenedor
        shareImageContainer.appendChild(shareView);
        
        // Configurar el botón de descarga
        downloadButton.textContent = 'Descargar imagen';
        downloadButton.onclick = () => {
            // Cambiar el botón mientras se procesa
            downloadButton.textContent = 'Procesando...';
            downloadButton.disabled = true;
            
            // Intentar generar imagen para descargar
            html2canvas(document.getElementById('capture-this'), {
                backgroundColor: '#282828',
                scale: 2, // Mayor calidad
                logging: false,
                useCORS: true, // Permitir cargar imágenes de otros dominios
                allowTaint: true // Permitir imágenes de otros dominios
            }).then(canvas => {
                // Convertir canvas a URL de datos
                const imageData = canvas.toDataURL('image/png');
                
                // Crear un enlace para descargar
                const link = document.createElement('a');
                link.href = imageData;
                link.download = 'mi-museo-musical.png';
                
                // Simular clic para descargar automáticamente
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Restaurar el botón
                downloadButton.textContent = 'Descargar imagen';
                downloadButton.disabled = false;
            }).catch(error => {
                console.error('Error generando la imagen:', error);
                downloadButton.textContent = 'Error - Intenta de nuevo';
                downloadButton.disabled = false;
                
                // Mostrar mensaje de error
                const errorMsg = document.createElement('p');
                errorMsg.textContent = 'No se pudo generar la imagen. Intenta de nuevo.';
                errorMsg.style.color = '#ff6b6b';
                errorMsg.style.margin = '10px 0';
                shareImageContainer.appendChild(errorMsg);
            });
        };
        
    } catch (error) {
        console.error('Error generando la vista para compartir:', error);
        shareImageContainer.innerHTML = '<p>Ha ocurrido un error. Por favor intenta de nuevo.</p>';
    }
}

// Event listeners optimizados para dispositivos móviles
loginButton.addEventListener('click', login);
logoutButton.addEventListener('click', logout);

// Evento para mostrar el modal (con detección de tap)
shareButton.addEventListener('click', () => {
    shareModal.classList.remove('hidden');
    generateShareImage();
});

// Cerrar el modal (con mejor detección para móviles)
closeModal.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    shareModal.classList.add('hidden');
});

// Cerrar el modal haciendo clic fuera (mejor para táctiles)
shareModal.addEventListener('click', (event) => {
    if (event.target === shareModal) {
        shareModal.classList.add('hidden');
    }
});

// Cerrar el modal con la tecla Escape
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !shareModal.classList.contains('hidden')) {
        shareModal.classList.add('hidden');
    }
});

// Evento para ajustar la interfaz si el dispositivo cambia de orientación
window.addEventListener('resize', () => {
    // Si estamos en la pantalla del museo, actualizar el collage
    if (!museumScreen.classList.contains('hidden')) {
        createCollage();
    }
});

// Inicialización
window.addEventListener('load', async () => {
    // Asegurar que el modal esté oculto al cargar la página
    shareModal.classList.add('hidden');
    
    // Comprobar si hay token en la URL (después de autenticación)
    const params = getHashParams();
    const token = params.access_token;
    
    if (token) {
        // Guardar token
        localStorage.setItem('spotify_access_token', token);
        // Limpiar URL
        window.location.hash = '';
        
        try {
            // Mostrar pantalla de carga
            loginScreen.innerHTML = '<h2>Cargando...</h2><p>Obteniendo tu música...</p>';
            
            // Obtener datos del usuario y elementos top
            userProfileData = await fetchUserProfile(token);
            
            const artistsData = await fetchTopItems(token, 'artists', 30);
            topArtists = artistsData.items || [];
            
            const tracksData = await fetchTopItems(token, 'tracks', 30);
            topTracks = tracksData.items || [];
            
            // Restaurar pantalla de login (por si falla)
            loginScreen.innerHTML = '<h1>Museo Musical</h1><p>Visualiza tu gusto musical como una obra de arte</p><button id="login-button" class="button">Iniciar sesión con Spotify</button>';
            document.getElementById('login-button').addEventListener('click', login);
            
            // Crear collage y mostrar pantalla del museo
            createCollage();
            showMuseumScreen();
        } catch (error) {
            console.error('Error fetching data:', error);
            alert('Ha ocurrido un error al conectar con Spotify. Por favor, inténtalo de nuevo.');
            logout();
        }
    } else {
        // Comprobar si hay token guardado
        const savedToken = localStorage.getItem('spotify_access_token');
        if (savedToken) {
            try {
                // Mostrar pantalla de carga
                loginScreen.innerHTML = '<h2>Cargando...</h2><p>Recuperando tu música...</p>';
                
                // Verificar que el token sigue siendo válido
                userProfileData = await fetchUserProfile(savedToken);
                
                const artistsData = await fetchTopItems(savedToken, 'artists', 30);
                topArtists = artistsData.items || [];
                
                const tracksData = await fetchTopItems(savedToken, 'tracks', 30);
                topTracks = tracksData.items || [];
                
                // Restaurar pantalla de login (por si falla)
                loginScreen.innerHTML = '<h1>Museo Musical</h1><p>Visualiza tu gusto musical como una obra de arte</p><button id="login-button" class="button">Iniciar sesión con Spotify</button>';
                document.getElementById('login-button').addEventListener('click', login);
                
                createCollage();
                showMuseumScreen();
            } catch (error) {
                console.error('Error con el token guardado:', error);
                // Restaurar pantalla de login
                loginScreen.innerHTML = '<h1>Museo Musical</h1><p>Visualiza tu gusto musical como una obra de arte</p><button id="login-button" class="button">Iniciar sesión con Spotify</button>';
                document.getElementById('login-button').addEventListener('click', login);
                
                logout();
            }
        } else {
            showLoginScreen();
        }
    }
});