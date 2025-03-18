// Configuración de Spotify API
const clientId = '97d973ea484b40d592cbf2e18ca5fd5c'; // Reemplazar con tu Client ID de Spotify
const redirectUri = window.location.origin + window.location.pathname;
const scope = 'user-top-read user-read-recently-played';

// Elementos DOM
const loginScreen = document.getElementById('login-screen');
const museumScreen = document.getElementById('museum-screen');
const loginButton = document.getElementById('login-button');
const shareButton = document.getElementById('share-button');
const paintingContent = document.querySelector('.painting-content');
const shareOverlay = document.getElementById('share-overlay');
const shareImage = document.getElementById('share-image');
const cancelShareButton = document.getElementById('cancel-share');
const confirmShareButton = document.getElementById('confirm-share');

// Función para generar un string aleatorio para state
function generateRandomString(length) {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

// Iniciar sesión con Spotify
loginButton.addEventListener('click', () => {
    const state = generateRandomString(16);
    localStorage.setItem('spotify_auth_state', state);

    const authorizeUrl = 'https://accounts.spotify.com/authorize';
    const params = new URLSearchParams({
        response_type: 'token',
        client_id: clientId,
        scope: scope,
        redirect_uri: redirectUri,
        state: state,
        show_dialog: true
    });

    window.location = `${authorizeUrl}?${params.toString()}`;
});

// Comprobar si el usuario está volviendo de la autenticación
window.addEventListener('load', () => {
    const hash = window.location.hash.substring(1);
    
    if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const state = params.get('state');
        const storedState = localStorage.getItem('spotify_auth_state');

        if (accessToken && (state === null || state === storedState)) {
            // Limpiar la URL
            window.history.pushState("", document.title, window.location.pathname);
            
            // Guardar el token y mostrar el museo
            localStorage.setItem('spotify_access_token', accessToken);
            showMuseum(accessToken);
        }
    } else if (localStorage.getItem('spotify_access_token')) {
        // Si ya tenemos un token guardado, mostrar el museo directamente
        showMuseum(localStorage.getItem('spotify_access_token'));
    }
});

// Mostrar la pantalla del museo y cargar los datos
async function showMuseum(token) {
    try {
        // Mostrar indicador de carga
        document.getElementById('loading-indicator').classList.remove('hidden');
        
        // Obtener datos de Spotify
        const [recentTracks, topTracks, topArtists, topAlbums] = await Promise.all([
            getRecentlyPlayed(token),
            getTopItems(token, 'tracks'),
            getTopItems(token, 'artists'),
            getTopAlbums(token)
        ]);

        // Crear un array con todas las imágenes que queremos mostrar
        const allCovers = [
            ...recentTracks.map(track => ({
                image: track.track.album.images[0].url,
                type: 'reciente'
            })),
            ...topTracks.map(track => ({
                image: track.album.images[0].url,
                type: 'top-track'
            })),
            ...topArtists.filter(artist => artist.images && artist.images.length > 0).map(artist => ({
                image: artist.images[0].url,
                type: 'artista'
            })),
            ...topAlbums.map(album => ({
                image: album.images[0].url,
                type: 'album'
            }))
        ];

        // Duplicar portadas para tener suficientes para llenar el marco
        let duplicatedCovers = [];
        // Duplicar cada portada 2-3 veces para asegurar densidad
        allCovers.forEach(cover => {
            const duplicates = Math.floor(Math.random() * 2) + 2; // 2-3 duplicados
            for (let i = 0; i < duplicates; i++) {
                duplicatedCovers.push(cover);
            }
        });
        
        // Mezclar todas las portadas para distribución aleatoria
        const mixedCovers = shuffleArray([...allCovers, ...duplicatedCovers]);
        
        // Aseguramos tener al menos 100 elementos para un efecto muy saturado
        const finalCovers = mixedCovers.slice(0, Math.max(100, mixedCovers.length));
        
        // Mostrar las portadas en el cuadro
        displayCovers(finalCovers);
        
        // Ocultar indicador de carga
        document.getElementById('loading-indicator').classList.add('hidden');
        
        // Cambiar a la pantalla del museo
        loginScreen.classList.add('hidden');
        museumScreen.classList.remove('hidden');
    } catch (error) {
        console.error('Error al cargar datos de Spotify:', error);
        document.getElementById('loading-indicator').classList.add('hidden');
        alert('Ha ocurrido un error al cargar tus datos de Spotify. Por favor, intenta de nuevo.');
    }
}

// Obtener canciones reproducidas recientemente
async function getRecentlyPlayed(token) {
    const response = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=20', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
        throw new Error('Error al obtener canciones recientes');
    }
    
    const data = await response.json();
    return data.items;
}

// Obtener elementos top (canciones o artistas)
async function getTopItems(token, type) {
    const response = await fetch(`https://api.spotify.com/v1/me/top/${type}?time_range=medium_term&limit=20`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) {
        throw new Error(`Error al obtener top ${type}`);
    }
    
    const data = await response.json();
    return data.items;
}

// Obtener álbumes top (a partir de las canciones top)
async function getTopAlbums(token) {
    const topTracks = await getTopItems(token, 'tracks');
    
    // Extraer albums únicos de las canciones top
    const uniqueAlbums = [];
    const albumIds = new Set();
    
    for (const track of topTracks) {
        if (!albumIds.has(track.album.id)) {
            albumIds.add(track.album.id);
            uniqueAlbums.push(track.album);
        }
    }
    
    return uniqueAlbums;
}

// Mostrar las portadas en el cuadro con distribución para llenar completamente el espacio
function displayCovers(covers) {
    // Obtener dimensiones del contenedor
    const paintingElement = document.querySelector('.painting');
    const containerWidth = paintingElement.offsetWidth;
    const containerHeight = paintingElement.offsetHeight;
    
    // Asegurarse de que el contenedor tenga una altura mínima
    if (containerHeight < 400) {
        paintingElement.style.height = '600px';
    }
    
    // Obtener dimensiones actualizadas
    const width = containerWidth || 800;
    const height = containerHeight || 600;
    
    // Limpiar el contenido existente
    paintingContent.innerHTML = '';
    
    // Tamaños variables para las portadas (en general más pequeñas para que quepan más)
    const sizes = [50, 60, 70, 80, 90, 100]; // Añadir tamaños más pequeños
    
    // Crear una cuadrícula más densa para distribuir las portadas
    const gridRows = 12; // Aumentar número de filas
    const gridCols = 12; // Aumentar número de columnas
    
    // Calcular coordenadas específicas para cada posición de la cuadrícula
    const positions = [];
    
    for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
            // Calcular posición con margen para no pegar completamente a los bordes
            const margin = 5; // Reducir el margen
            const cellWidth = (width - (2 * margin)) / gridCols;
            const cellHeight = (height - (2 * margin)) / gridRows;
            
            // La posición base es el centro de cada celda de la cuadrícula
            const baseX = margin + (col * cellWidth) + (cellWidth / 2);
            const baseY = margin + (row * cellHeight) + (cellHeight / 2);
            
            // Añadir algo de aleatoriedad, pero limitada para mantener la estructura
            const randomOffsetX = (Math.random() - 0.5) * (cellWidth * 0.6);
            const randomOffsetY = (Math.random() - 0.5) * (cellHeight * 0.6);
            
            positions.push({
                x: baseX + randomOffsetX,
                y: baseY + randomOffsetY
            });
        }
    }
    
    // Mezclar las posiciones para que no haya un patrón evidente
    shuffleArray(positions);
    
    // Duplicar covers si son insuficientes para llenar todas las posiciones
    let extendedCovers = [...covers];
    while (extendedCovers.length < positions.length) {
        extendedCovers = [...extendedCovers, ...covers];
    }
    
    // Mezclar las portadas duplicadas para evitar patrones obvios
    shuffleArray(extendedCovers);
    
    // Limitar el número de portadas al número de posiciones disponibles
    const numCovers = Math.min(extendedCovers.length, positions.length);
    
    // Colocar cada portada en su posición correspondiente
    for (let i = 0; i < numCovers; i++) {
        const cover = extendedCovers[i];
        const position = positions[i];
        const size = sizes[Math.floor(Math.random() * sizes.length)];
        
        // Crear el elemento para la portada
        const coverElement = document.createElement('div');
        coverElement.className = 'album-cover';
        coverElement.style.width = `${size}px`;
        coverElement.style.height = `${size}px`;
        
        // Centrar la portada en la posición calculada
        coverElement.style.left = `${position.x - (size / 2)}px`;
        coverElement.style.top = `${position.y - (size / 2)}px`;
        
        // Rotación aleatoria para dar efecto de collage
        const rotation = Math.floor(Math.random() * 40) - 20; // Entre -20 y 20 grados
        coverElement.style.transform = `rotate(${rotation}deg)`;
        
        // Imagen de la portada
        const img = document.createElement('img');
        img.src = cover.image;
        img.alt = `Portada ${cover.type}`;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        
        // Añadir efecto de sombra para dar profundidad
        coverElement.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
        
        // Añadir un zIndex aleatorio para crear sensación de profundidad
        coverElement.style.zIndex = Math.floor(Math.random() * 10) + 1;
        
        // Añadir retardo de animación escalonado
        coverElement.style.setProperty('--animation-order', i % 20);
        
        coverElement.appendChild(img);
        paintingContent.appendChild(coverElement);
    }
    
    // Añadir una capa adicional de pequeñas portadas para llenar espacios en blanco
    addFillerCovers(extendedCovers, width, height);
}

// Función para añadir portadas adicionales más pequeñas para llenar espacios en blanco
function addFillerCovers(covers, width, height) {
    // Calcular cuántas portadas adicionales añadir (20% más)
    const numAdditional = Math.floor(covers.length * 0.2);
    
    // Tamaños más pequeños para las portadas de relleno
    const smallSizes = [30, 40, 45];
    
    for (let i = 0; i < numAdditional; i++) {
        const cover = covers[Math.floor(Math.random() * covers.length)];
        const size = smallSizes[Math.floor(Math.random() * smallSizes.length)];
        
        // Posición aleatoria dentro del contenedor
        const x = Math.random() * (width - size);
        const y = Math.random() * (height - size);
        
        // Crear el elemento para la portada de relleno
        const coverElement = document.createElement('div');
        coverElement.className = 'album-cover filler';
        coverElement.style.width = `${size}px`;
        coverElement.style.height = `${size}px`;
        coverElement.style.left = `${x}px`;
        coverElement.style.top = `${y}px`;
        
        // Rotación aleatoria
        const rotation = Math.floor(Math.random() * 60) - 30; // Entre -30 y 30 grados
        coverElement.style.transform = `rotate(${rotation}deg)`;
        
        // Imagen de la portada
        const img = document.createElement('img');
        img.src = cover.image;
        img.alt = `Portada de relleno`;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        
        // Reducir la opacidad para que parezcan estar en un segundo plano
        coverElement.style.opacity = '0.8';
        
        // Zindex bajo para que estén detrás de las portadas principales
        coverElement.style.zIndex = '1';
        
        coverElement.appendChild(img);
        paintingContent.appendChild(coverElement);
    }
}

// Función auxiliar para mezclar un array aleatoriamente (algoritmo Fisher-Yates)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Función para compartir el cuadro
shareButton.addEventListener('click', async () => {
    try {
        // Esperar a que todo esté cargado antes de generar la imagen
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const paintingElement = document.querySelector('.frame');
        
        // Asegurarse de que el contenedor tenga dimensiones definidas
        const paintingContent = document.querySelector('.painting-content');
        const computedStyle = window.getComputedStyle(paintingContent);
        
        // Establecer dimensiones explícitas si es necesario
        if (computedStyle.height === 'auto' || parseInt(computedStyle.height) < 400) {
            paintingContent.style.height = '600px';
        }
        
        // Configurar opciones para html2canvas
        const options = {
            backgroundColor: '#F5F5F5',
            useCORS: true, // Permitir el uso de imágenes de otros dominios
            allowTaint: true, // Permitir imágenes que pueden "contaminar" el canvas
            scale: 2, // Mejorar la calidad
            logging: true, // Activar logging para depuración
            onclone: (clonedDoc) => {
                // Manipular el DOM clonado antes de renderizar
                const clonedPainting = clonedDoc.querySelector('.painting');
                // Asegurarse de que el clon tenga altura suficiente
                if (clonedPainting) {
                    clonedPainting.style.height = '600px';
                }
            }
        };
        
        // Crear el canvas con html2canvas
        const canvas = await html2canvas(paintingElement, options);
        
        // Mostrar la previsualización en el overlay
        shareImage.src = canvas.toDataURL('image/png');
        shareOverlay.classList.remove('hidden');
        
        // Guardar la referencia al canvas para compartir
        shareOverlay.dataset.canvas = canvas.toDataURL('image/png');
    } catch (error) {
        console.error('Error al generar la imagen:', error);
        alert('Ha ocurrido un error al generar la imagen. Por favor, intenta de nuevo.');
    }
});

// Cancelar compartir
cancelShareButton.addEventListener('click', () => {
    shareOverlay.classList.add('hidden');
});

// Confirmar compartir
confirmShareButton.addEventListener('click', async () => {
    try {
        const dataUrl = shareOverlay.dataset.canvas;
        
        // Convertir dataURL a Blob
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        
        // Compartir usando la Web Share API si está disponible
        if (navigator.share) {
            await navigator.share({
                files: [new File([blob], 'museo-musical.png', { type: 'image/png' })],
                title: 'Mi Museo Musical',
                text: 'Mira mi museo musical basado en mi actividad en Spotify. Visita nam3.es para crear el tuyo.'
            });
        } else {
            // Fallback para navegadores que no soportan Web Share API
            const link = document.createElement('a');
            link.href = dataUrl;
            link.download = 'museo-musical.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
        
        // Ocultar el overlay
        shareOverlay.classList.add('hidden');
    } catch (error) {
        console.error('Error al compartir la imagen:', error);
        alert('Ha ocurrido un error al compartir la imagen. Por favor, intenta de nuevo.');
    }
});