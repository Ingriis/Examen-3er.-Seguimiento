import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';


let camara, escenario, renderizador, cronometro, mezclador, modelo, animaciones, animacionActiva, animacionAnterior, controles, pointerLockControls;
const teclado = {};
const velocidadMovimiento = 105;
const objetosColisionables = [];
const boundingBoxesColisionables = [];
const estadisticas = new Stats();


iniciarEscenario();
animarEscena();

function iniciarEscenario() {
    const contenedor = document.createElement('div');
    document.body.appendChild(contenedor);

    const footer = document.createElement('div');
    footer.style.position = 'fixed';
    footer.style.bottom = '0';
    footer.style.left = '0';
    footer.style.width = '100%';
    footer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    footer.style.color = 'white';
    footer.style.padding = '10px';
    footer.style.textAlign = 'center';
    footer.style.fontFamily = 'Arial';
    footer.style.zIndex = '1000';

    const title = document.createElement('h1');
    title.textContent = 'Escena 3D: Aventura en la Nieve';
    title.style.color = 'white';
    title.style.margin = '5px 0';
    title.style.fontWeight = 'bold';

    const credits = document.createElement('div');
    credits.innerHTML = `
        <p style="margin: 5px 0; font-weight: bold;">
            Equipo: Hernández Gómez Ingrid (22200738) - Santiago Rodríguez Alan (22200767)
        </p>
    `;

    const controlsInfo = document.createElement('div');
    controlsInfo.innerHTML = `
        <p style="margin: 5px 0;"><strong>Controles:</strong></p>
        <p style="margin: 3px 0;">WASD: Caminar | WASD + Shift: Correr</p>
        <p style="margin: 3px 0;">1: Saltar | 2: Bailar | 3: Disparar | 4: Amenazar</p>
        <p style="margin: 3px 0;">Ratón: Mirar </p>
    `;

    footer.appendChild(title);
    footer.appendChild(credits);
    footer.appendChild(controlsInfo);
    document.body.appendChild(footer);

    camara = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 2000);
    camara.position.set(0, 300, 350);
    camara.screenSpacePanning = false;

    escenario = new THREE.Scene();

    escenario.fog = new THREE.Fog(0xd3d3d3, 50, 1500);
    // Crear la luz direccional

    const luzHemisferica = new THREE.HemisphereLight(0x199e3b, 0x199e3b);
    luzHemisferica.position.set(0, 300, 0);
    escenario.add(luzHemisferica);

    const luzDireccional = new THREE.DirectionalLight(0xffffff);
    luzDireccional.position.set(200, 300, 100);
    luzDireccional.castShadow = true;
    luzDireccional.shadow.camera.top = 280;
    luzDireccional.shadow.camera.bottom = -100;
    luzDireccional.shadow.camera.left = -120;
    luzDireccional.shadow.camera.right = 120;
    escenario.add(luzDireccional);

    const loader = new THREE.TextureLoader();

    const texturaColor = loader.load('Models/background/textures/snowdiff.jpg');
    const texturaNormal = loader.load('Models/background/textures/snownor.jpg'); 
    const texturaRugosidad = loader.load('Models/background/textures/snowrough.jpg');

    const geometriaSuelo = new THREE.PlaneGeometry(4000, 4000, 64, 64); // subdivisiones por si usas displacement
    geometriaSuelo.setAttribute('uv2', new THREE.BufferAttribute(geometriaSuelo.attributes.uv.array, 2));

    const materialSuelo = new THREE.MeshStandardMaterial({
        map: texturaColor,
        normalMap: texturaNormal,
        roughnessMap: texturaRugosidad,
        roughness: 0.5,
        // displacementMap: loader.load('Models/background/textures/snow_01_disp_1k.png'),
        // displacementScale: 30, // solo si usas displacement
    });

    const suelo = new THREE.Mesh(geometriaSuelo, materialSuelo);
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;

    // Repetición de texturas
    [texturaColor, texturaNormal, texturaRugosidad].forEach(tex => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(8, 8);
    });

    escenario.add(suelo);

    pointerLockControls = new PointerLockControls(camara, document.body);
    escenario.add(pointerLockControls.getObject()); 


    const cargadorFBX = new FBXLoader();

    cargadorFBX.load('Models/fbx/Michelle.fbx', function (objeto) {
        modelo = objeto;
        modelo.scale.set(1, 1, 1);
        modelo.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        escenario.add(modelo);

        mezclador = new THREE.AnimationMixer(modelo);
        animaciones = {};

        cargarAnimaciones(cargadorFBX, mezclador, animaciones);
        crearObjetosUnicos([
            'Models/fbx/source/Barrel.fbx',
            'Models/fbx/source/Camping.fbx',
            'Models/fbx/source/Tent.fbx',
            'Models/fbx/source/Trunk.fbx',
            'Models/fbx/source/Bear.fbx'
        ], escenario, objetosColisionables);

        crearArbolesGLTF(100, escenario);

        window.addEventListener('keydown', manejarTeclaPresionada);
        window.addEventListener('keyup', manejarTeclaSoltada);
    });

    renderizador = new THREE.WebGLRenderer({ antialias: true });
    renderizador.setPixelRatio(window.devicePixelRatio);
    renderizador.setSize(window.innerWidth, window.innerHeight);
    renderizador.shadowMap.enabled = true;
    contenedor.appendChild(renderizador.domElement);

    establecerFondoCieloHDR('Models/background/background.hdr');


    controles = new OrbitControls(camara, renderizador.domElement);
    controles.target.set(0, 100, 0);
    controles.update();

    window.addEventListener('resize', ajustarVentana);

    cronometro = new THREE.Clock();
    contenedor.appendChild(estadisticas.dom);

    const gui = new GUI({ 
    width: 300,
    title: 'Ajustes de Ambiente',
    closeOnTop: true
    });

    // Estilo personalizado para la GUI
    gui.domElement.style.position = 'absolute';
    gui.domElement.style.right = '10px';
    gui.domElement.style.top = '10px';

    // Configuración de la carpeta de Iluminación
    const carpetaLuz = gui.addFolder('🌞 Iluminación');
    carpetaLuz.add(luzDireccional, 'intensity', 0, 5, 0.1)
        .name('Luz Solar')
        .onChange(val => {
            luzDireccional.intensity = val;
            if (val > 0) luzDireccional.visible = true;
            else luzDireccional.visible = false;
        });

    carpetaLuz.add(luzHemisferica, 'intensity', 0, 3, 0.1)
        .name('Luz Ambiente')
        .onChange(val => {
            luzHemisferica.intensity = val;
            if (val > 0) luzHemisferica.visible = true;
            else luzHemisferica.visible = false;
        });

    carpetaLuz.addColor({ color: luzDireccional.color.getHex() }, 'color')
        .name('Color Solar')
        .onChange(val => luzDireccional.color.setHex(val))

    // Configuración de la carpeta de Neblina
    const carpetaNiebla = gui.addFolder('🌫️ Atmósfera');
    carpetaNiebla.add(escenario.fog, 'near', 10, 500, 1).name('Inicio Niebla');
    carpetaNiebla.add(escenario.fog, 'far', 500, 3000, 10).name('Fin Niebla');
    carpetaNiebla.addColor({ color: escenario.fog.color.getHex() }, 'color')
        .name('Color Niebla')
        .onChange(val => escenario.fog.color.setHex(val));

    // Añadir controles adicionales para mejor experiencia
    const extras = gui.addFolder('⚙️ Extras');

    // Añadir botón para resetear valores
    extras.add({
        Resetear: () => {
            luzDireccional.intensity = 1;
            luzHemisferica.intensity = 0.5;
            escenario.fog.near = 50;
            escenario.fog.far = 1500;
            gui.updateDisplay();
        }
    }, 'Resetear').name('🔁 Valores por Defecto');

    // Abrir las carpetas por defecto
    carpetaLuz.open();
    carpetaNiebla.open();
    extras.close();

}

function establecerFondoCieloHDR(hdrRuta) {
    const rgbeLoader = new RGBELoader();
    const pmremGenerator = new THREE.PMREMGenerator(renderizador);
    pmremGenerator.compileEquirectangularShader();

    rgbeLoader.load(hdrRuta, function (texture) {
        const envMap = pmremGenerator.fromEquirectangular(texture).texture;

        escenario.environment = envMap;
        escenario.background = envMap;

        texture.dispose();
        pmremGenerator.dispose();
    });
}

function cargarAnimaciones(cargador, mezclador, animaciones) {
    cargador.load('Models/fbx/combatidle.fbx', function (anim) {
        const accionIdle = mezclador.clipAction(anim.animations[0]);
        animaciones.idle = accionIdle;
        if (!animacionActiva) {
            animacionActiva = accionIdle;
            animacionActiva.play();
        }
    });

    cargador.load('Models/fbx/Walking.fbx', function (anim) {
        const accionCaminar = mezclador.clipAction(anim.animations[0]);
        accionCaminar.setLoop(THREE.LoopRepeat);
        accionCaminar.timeScale = 0.7;
        animaciones.walk = accionCaminar;
    });

    cargador.load('Models/fbx/Running.fbx', function (anim) {
        const accionRunning = mezclador.clipAction(anim.animations[0]);
        accionRunning.setLoop(THREE.LoopRepeat);
        accionRunning.timeScale = 0.7;
        animaciones.Running = accionRunning;
    });

    cargador.load('Models/fbx/Jump.fbx', function (anim) {
        const accionJump = mezclador.clipAction(anim.animations[0]);
        animaciones.Jump = accionJump;
    });

    cargador.load('Models/fbx/Dancing.fbx', function (anim) {
        const accionDancing = mezclador.clipAction(anim.animations[0]);
        animaciones.Dancing = accionDancing;
    });

    cargador.load('Models/fbx/Shooting.fbx', function (anim) {
        const accionShooting = mezclador.clipAction(anim.animations[0]);
        animaciones.Shooting = accionShooting;
    });

    cargador.load('Models/fbx/Threatening.fbx', function (anim) {
        const accionThreatening = mezclador.clipAction(anim.animations[0]);
        animaciones.Threatening = accionThreatening;
    });
}

function crearObjetosUnicos(rutasModelos, escenario, objetosColisionables) {
    const cargadorFBX = new FBXLoader();

    // Definir coordenadas específicas para cada objeto
    const posiciones = [
        new THREE.Vector3(-450, 0, -50), // Posición del barril
        new THREE.Vector3(-10, 0, 250), // Posición de la fogata
        new THREE.Vector3(10, 0, -500), // Posición de casa de campaña
        new THREE.Vector3(300, 0, -80), // Posición del tronco
        new THREE.Vector3(-400, 0, -220) // Posición del bear
    ];

    rutasModelos.forEach((ruta, index) => {
        cargadorFBX.load(ruta, function (objeto) {
            objeto.scale.set(1, 1, 1);

            const posicion = posiciones[index];
            objeto.position.copy(posicion);

            if (index === 3) {
                objeto.rotation.y = Math.PI / 2; //Tronco 90 grados
            }
            if (index === 4) {
                objeto.rotation.y = -Math.PI / 2; // Bear: -90 grados
            }

            objeto.traverse(function (child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            escenario.add(objeto);
            objetosColisionables.push(objeto);

            const box = new THREE.Box3().setFromObject(objeto);
            boundingBoxesColisionables.push(box);
        });
    });
}

function crearArbolesGLTF(cantidad, escenario) {
    const loader = new GLTFLoader();

    const zonaProhibida = {
        xMin: -900,
        xMax: 700,
        zMin: -800,
        zMax: 650
    };

    loader.load('Models/fbx/source/Tree.glb', function(gltf) {
        const arbolBase = gltf.scene;
        
        // Configuración del modelo
        arbolBase.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        const escalaBase = 500; // Ajusta según el tamaño de tu modelo
        arbolBase.scale.set(escalaBase, escalaBase, escalaBase);

        const zonasSeguras = [
            { xMin: -2000, xMax: zonaProhibida.xMin, zMin: -2000, zMax: 2000 }, // Zona izquierda
            { xMin: zonaProhibida.xMax, xMax: 2000, zMin: -2000, zMax: 2000 },   // Zona derecha
            { xMin: zonaProhibida.xMin, xMax: zonaProhibida.xMax, zMin: -2000, zMax: zonaProhibida.zMin }, // Zona inferior
            { xMin: zonaProhibida.xMin, xMax: zonaProhibida.xMax, zMin: zonaProhibida.zMax, zMax: 2000 }    // Zona superior
        ];

        for (let i = 0; i < cantidad; i++) {
            const arbol = arbolBase.clone();
            
            // 1. Seleccionar una zona segura aleatoria
            const zona = zonasSeguras[Math.floor(Math.random() * zonasSeguras.length)];
            
            // 2. Generar posición aleatoria dentro de la zona segura
            const x = Math.random() * (zona.xMax - zona.xMin) + zona.xMin;
            const z = Math.random() * (zona.zMax - zona.zMin) + zona.zMin;

            // 3. Posicionar el árbol
            arbol.position.set(x, 0, z);
            arbol.rotation.y = Math.random() * Math.PI * 2; // Rotación aleatoria
            
            // 4. Variación de tamaño (80% a 120% del tamaño base)
            arbol.scale.setScalar(escalaBase * (0.8 + Math.random() * 0.4));
            
            // 5. Añadir al escenario y sistemas de colisión
            escenario.add(arbol);
            objetosColisionables.push(arbol);
            boundingBoxesColisionables.push(new THREE.Box3().setFromObject(arbol));
        }

    }, undefined, error => {
        console.error("Error cargando árbol:", error);
    });
}


function ajustarVentana() {
    camara.aspect = window.innerWidth / window.innerHeight;
    camara.updateProjectionMatrix();
    renderizador.setSize(window.innerWidth, window.innerHeight);
}

function manejarTeclaPresionada(evento) {
    teclado[evento.key.toLowerCase()] = true;
    gestionarAnimacion();
}

function manejarTeclaSoltada(evento) {
    teclado[evento.key.toLowerCase()] = false;
    gestionarAnimacion();
}

function gestionarAnimacion() {
    if (teclado['1']) {
        if (animacionActiva !== animaciones.Jump) {
            cambiarAnimacion(animaciones.Jump);
        }
    } else if (teclado['2']) {
        if (animacionActiva !== animaciones.Dancing) {
            cambiarAnimacion(animaciones.Dancing);
        }
    } else if (teclado['3']) {
        if (animacionActiva !== animaciones.Shooting) {
            cambiarAnimacion(animaciones.Shooting);
        }
    } else if (teclado['4']) {
        if (animacionActiva !== animaciones.Threatening) {
            cambiarAnimacion(animaciones.Threatening);
        }
    } 
    // Luego movimiento (walk/Running)
    else if (teclado['w'] || teclado['s'] || teclado['a'] || teclado['d']) {
        const animacionDeseada = teclado['shift'] ? animaciones.Running : animaciones.walk;
        if (animacionActiva !== animacionDeseada) {
            cambiarAnimacion(animacionDeseada);
        }
    } 
    // Finalmente idle
    else {
        if (animacionActiva !== animaciones.idle) {
            cambiarAnimacion(animaciones.idle);
        }
    }
}

function cambiarAnimacion(nuevaAnimacion) {
    if (animacionActiva !== nuevaAnimacion) {
        animacionAnterior = animacionActiva;
        animacionActiva = nuevaAnimacion;

        animacionAnterior.fadeOut(0.5);
        animacionActiva.reset().fadeIn(0.5).play();
    }
}

function animarEscena() {
    requestAnimationFrame(animarEscena);

    const delta = cronometro.getDelta();
    const estaCorriendo = teclado['shift']; // Detectar si Shift está presionado
    const velocidadActual = estaCorriendo ? velocidadMovimiento * 1.5 : velocidadMovimiento;
    const distancia = velocidadActual * delta;

    // Actualizar animaciones
    if (mezclador) mezclador.update(delta);

    let moverX = 0;
    let moverZ = 0;

    // Movimiento básico (W/A/S/D)
    if (teclado['w']) moverZ = -distancia;
    if (teclado['s']) moverZ = distancia;
    if (teclado['a']) moverX = -distancia;
    if (teclado['d']) moverX = distancia;

    // Solo aplicar movimiento si no hay animación especial activa
    const animacionEspecialActiva = teclado['2'] || teclado['3'] || teclado['4'] || teclado['5'];
    if ((moverX !== 0 || moverZ !== 0) && !animacionEspecialActiva) {
        const vectorMovimiento = new THREE.Vector3(moverX, 0, moverZ);
        const direccion = vectorMovimiento.clone().applyQuaternion(camara.quaternion);
        direccion.y = 0;
        
        // Rotación del modelo hacia la dirección de movimiento
        modelo.lookAt(modelo.position.clone().add(direccion));
        
        // Verificar colisiones antes de mover
        const nuevaPosicion = modelo.position.clone().add(direccion);
        if (!verificarColision(nuevaPosicion)) {
            modelo.position.copy(nuevaPosicion); // Se mueve solo si no hay colisión
        }
    }

    // Renderizar escena
    renderizador.render(escenario, camara);
    estadisticas.update();
}

function verificarColision(nuevaPosicion) {
    const cajaActual = new THREE.Box3().setFromObject(modelo);
    const desplazamiento = nuevaPosicion.clone().sub(modelo.position);
    cajaActual.translate(desplazamiento);

    for (let i = 0; i < boundingBoxesColisionables.length; i++) {
        if (cajaActual.intersectsBox(boundingBoxesColisionables[i])) {
            return true;
        }
    }
    return false;
}

