var worldData = {
    articles: [{ id:'1', title:'Bienvenido a LoreForge', category:'Lugar', summary:'Tu primer artículo de ejemplo.', content:'¡Hola creador! Crea un personaje llamado [[Aldrin]] para enlazarlo automáticamente.' }],
    mapImage: null, pins: [],
    timeline: [{ id:'1', date:'Año 0', title:'La Fundación', desc:'Inicio de los registros históricos.' }]
  };
  var canStore = true;
  var tempInlineImgs = {};
  var activeFolder = 'Todas';
  /////////////////////////////////////////

// --- ALMACENAMIENTO DE IMAGENES CON INDEXEDDB ---

var mapDBPromise = null;
var mapObjectUrl = null;

function openMapDB() {
    if (!window.indexedDB) {
        return Promise.reject(
            new Error('Este navegador no admite IndexedDB.')
        );
    }

    if (!mapDBPromise) {
        mapDBPromise = new Promise(function(resolve, reject) {
            var request = window.indexedDB.open('LoreForgeMedia', 1);

            request.onupgradeneeded = function() {
                var db = request.result;

                if (!db.objectStoreNames.contains('images')) {
                    db.createObjectStore('images');
                }
            };

            request.onsuccess = function() {
                resolve(request.result);
            };

            request.onerror = function() {
                reject(request.error);
            };
        });
    }

    return mapDBPromise;
}

function storeMapImage(blob) {
    return openMapDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction('images', 'readwrite');

            tx.objectStore('images').put(blob, 'worldMap');

            tx.oncomplete = function() {
                resolve();
            };

            tx.onerror = function() {
                reject(tx.error);
            };

            tx.onabort = function() {
                reject(tx.error);
            };
        });
    });
}

function getMapImage() {
    return openMapDB().then(function(db) {
        return new Promise(function(resolve, reject) {
            var tx = db.transaction('images', 'readonly');
            var request = tx.objectStore('images').get('worldMap');

            request.onsuccess = function() {
                resolve(request.result || null);
            };

            request.onerror = function() {
                reject(request.error);
            };
        });
    });
}
// borrar imagen si se carga un zip sin imagen
function deleteMapImage() {
  return openMapDB().then(function(db) {
      return new Promise(function(resolve, reject) {
          var tx = db.transaction('images', 'readwrite');

          tx.objectStore('images').delete('worldMap');

          tx.oncomplete = function() {
              resolve();
          };

          tx.onerror = function() {
              reject(tx.error);
          };

          tx.onabort = function() {
              reject(tx.error);
          };
      });
  });
}


function migrateLegacyMap() {
  if (!worldData.mapImage) {
      return renderMap();
  }

  return fetch(worldData.mapImage)
      .then(function(response) {
          if (!response.ok) {
              throw new Error('No se pudo leer el mapa antiguo.');
          }
          return response.blob();
      })
      .then(function(blob) {
          return storeMapImage(blob);
      })
      .then(function() {
          worldData.mapImage = null;
          saveData();
          console.log('Mapa antiguo migrado correctamente.');
          return renderMap();
      })
      .catch(function(error) {
          console.error('Error al migrar el mapa:', error);
          alert('No se pudo trasladar el mapa antiguo. Se conservarán los datos originales.');
      });
}


  /////////////////////////////////////////
  try { var s = localStorage.getItem('loreforge_data'); if (s) worldData = JSON.parse(s); }
  catch (e) { canStore = false; document.getElementById('status-txt').innerText = 'Usa Descargar Copia para guardar'; }

// el guardado de los datos (actualizado para avisar de errores al guardar los datos)
  
function saveData() {
  if (!canStore) return;

  try {
      localStorage.setItem('loreforge_data', JSON.stringify(worldData));
      document.getElementById('status-txt').innerText = 'Guardado correctamente';
  } catch (e) {
      document.getElementById('status-txt').innerText =
          'Error al guardar: almacenamiento lleno o no disponible';

      console.error('Error al guardar LoreForge:', e);
      alert('No se han podido guardar los datos. Descarga una copia de seguridad.');
  }
}

// el cambio de pestaña en el navegador de la aplicacion
  function switchTab(t) {
    ['wiki','map','timeline'].forEach(function(x) {
      document.getElementById('tab-'+x).classList.add('hidden');
      document.getElementById('nav-'+x).classList.remove('active');
    });
    document.getElementById('tab-'+t).classList.remove('hidden');
    document.getElementById('nav-'+t).classList.add('active');
    if (t==='map') renderMap();
    if (t==='timeline') renderTl();
  }
// funcion para cargar las carpetas
  function renderFolders() {
    var bar = document.getElementById('folder-bar');
    var dl = document.getElementById('folder-list');
    if (!bar || !dl) return;
    bar.innerHTML = ''; dl.innerHTML = '';
    var folders = ['Todas'];
    worldData.articles.forEach(function(a) {
      var f = a.folder || 'Sin carpeta';
      if (folders.indexOf(f) === -1) folders.push(f);
    });
    folders.forEach(function(f) {
      var chip = document.createElement('button');
      chip.className = 'f-chip' + (activeFolder === f ? ' active' : '');
      chip.textContent = (f === 'Todas' ? '🗂️ Todas las carpetas' : '📁 ' + f);
      chip.onclick = function() { activeFolder = f; renderArticles(); };
      bar.appendChild(chip);
      if (f !== 'Todas' && f !== 'Sin carpeta') {
        var opt = document.createElement('option'); opt.value = f;
        dl.appendChild(opt);
      }
    });
  }
//funcion que carga/muestra los articulos
  function renderArticles() {
    renderFolders();
    var g = document.getElementById('art-grid');
    var q = document.getElementById('q-search').value.toLowerCase();
    var c = document.getElementById('q-cat').value;
    g.innerHTML = '';
    worldData.articles.filter(function(a) {
      var f = a.folder || 'Sin carpeta';
      var matchFolder = (activeFolder === 'Todas' || f === activeFolder);
      var matchCat = (c === 'Todos' || a.category === c);
      var matchText = (a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q) || a.content.toLowerCase().includes(q));
      return matchFolder && matchCat && matchText;
    }).forEach(function(a) {
      var d = document.createElement('div'); d.className = 'card';
      d.onclick = function() { readArt(a.id); };
      var sp = document.createElement('span'); sp.className = 'badge';
      sp.textContent = a.category + (a.folder && a.folder !== 'Sin carpeta' ? ' • 📁 ' + a.folder : '');
      var h3 = document.createElement('h3'); h3.textContent = a.title;
      var p = document.createElement('p'); p.textContent = a.summary || a.content.replace(/\[\[IMG:.*?\]\]/g, '[Imagen]');
      d.appendChild(sp); d.appendChild(h3); d.appendChild(p);
      g.appendChild(d);
    });
  }

// funcion para insertar una imagen al articulo
  function insertInlineImg(e) {
    var f = e.target.files[0];
    if (!f) return;
    var caption = prompt('Pie de foto o descripción breve (opcional):') || '';
    var r = new FileReader();
    r.onload = function(ev) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var scale = img.width > 750 ? (750 / img.width) : 1;
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        var imgId = 'img_' + Date.now();
        tempInlineImgs[imgId] = canvas.toDataURL('image/jpeg', 0.78);
        var ta = document.getElementById('ed-body');
        var tag = '\n[[IMG:' + imgId + '|' + caption.replace(/\]\]/g, '') + ']]\n';
        var start = ta.selectionStart;
        ta.value = ta.value.substring(0, start) + tag + ta.value.substring(ta.selectionEnd);
        e.target.value = '';
      };
      img.src = ev.target.result;
    };
    r.readAsDataURL(f);
  }
// funcion para abrir el creador/editor de articulos
  function openEditor(id) {
    document.getElementById('wiki-list').classList.add('hidden');
    document.getElementById('wiki-read').classList.add('hidden');
    document.getElementById('wiki-edit').classList.remove('hidden');
    if (id) {
      var a = worldData.articles.find(function(x){ return x.id===id; });
      document.getElementById('ed-head').innerText = 'Editar Artículo';
      document.getElementById('ed-id').value = a.id;
      document.getElementById('ed-tit').value = a.title;
      document.getElementById('ed-cat').value = a.category;
      document.getElementById('ed-folder').value = (a.folder && a.folder !== 'Sin carpeta') ? a.folder : '';
      document.getElementById('ed-sum').value = a.summary;
      document.getElementById('ed-body').value = a.content;
      tempInlineImgs = Object.assign({}, a.inlineImages || {});
    } else {
      document.getElementById('ed-head').innerText = 'Crear Artículo';
      ['ed-id','ed-tit','ed-sum','ed-body'].forEach(function(k){ document.getElementById(k).value=''; });
      document.getElementById('ed-folder').value = (activeFolder !== 'Todas' && activeFolder !== 'Sin carpeta') ? activeFolder : '';
      tempInlineImgs = {};
    }
  }
// funcion para guardar articulos
  function saveArticle() {
    var id = document.getElementById('ed-id').value;
    var tit = document.getElementById('ed-tit').value.trim();
    if (!tit) return alert('Escribe un título.');
    var folderVal = document.getElementById('ed-folder').value.trim() || 'Sin carpeta';
    var contentVal = document.getElementById('ed-body').value;
    var cleanInline = {};
    Object.keys(tempInlineImgs).forEach(function(k) {
      if (contentVal.indexOf('[[IMG:' + k) !== -1) cleanInline[k] = tempInlineImgs[k];
    });
    var obj = {
      id: id || Date.now().toString(),
      title: tit,
      category: document.getElementById('ed-cat').value,
      folder: folderVal,
      inlineImages: cleanInline,
      summary: document.getElementById('ed-sum').value.trim(),
      content: contentVal
    };
    if (id) worldData.articles[worldData.articles.findIndex(function(x){ return x.id===id; })] = obj;
    else worldData.articles.push(obj);
    saveData(); closeViews(); renderArticles();
  }
 // funcion para cargar los articulos
  function readArt(id) {
    var a = worldData.articles.find(function(x){ return x.id===id; });
    if (!a) return;
    document.getElementById('wiki-list').classList.add('hidden');
    document.getElementById('wiki-edit').classList.add('hidden');
    document.getElementById('wiki-read').classList.remove('hidden');
    document.getElementById('r-cat').innerText = a.category + (a.folder && a.folder !== 'Sin carpeta' ? ' • 📁 ' + a.folder : '');
    document.getElementById('r-tit').innerText = a.title;
    document.getElementById('r-sum').innerText = a.summary;

    var bodyEl = document.getElementById('r-body');
    bodyEl.innerHTML = '';
    a.content.split(/(\[\[.*?\]\])/g).forEach(function(part) {
      if (part.startsWith('[[IMG:') && part.endsWith(']]')) {
        var raw = part.slice(6, -2), sep = raw.indexOf('|');
        var imgId = sep !== -1 ? raw.slice(0, sep) : raw;
        var cap = sep !== -1 ? raw.slice(sep + 1) : '';
        if (a.inlineImages && a.inlineImages[imgId]) {
          var fig = document.createElement('figure'); fig.className = 'inline-fig';
          var im = document.createElement('img'); im.src = a.inlineImages[imgId];
          fig.appendChild(im);
          if (cap) { var fc = document.createElement('figcaption'); fc.textContent = cap; fig.appendChild(fc); }
          bodyEl.appendChild(fig);
        }
      } else if (part.startsWith('[[') && part.endsWith(']]')) {
        var linkTitle = part.slice(2, -2);
        var t = worldData.articles.find(function(x){ return x.title.toLowerCase()===linkTitle.toLowerCase(); });
        var sp = document.createElement('span'); sp.textContent = linkTitle;
        if (t) { sp.className = 'wlink'; sp.onclick = function() { readArt(t.id); }; }
        else { sp.style.color = 'var(--muted)'; sp.style.textDecoration = 'underline dashed'; }
        bodyEl.appendChild(sp);
      } else {
        bodyEl.appendChild(document.createTextNode(part));
      }
    });

    document.getElementById('btn-ed').onclick = function(){ openEditor(a.id); };
    document.getElementById('btn-dl').onclick = function(){ delArt(a.id); };
  }

// borrar articulo
  function delArt(id) {
    if (confirm('¿Borrar artículo?')) {
      worldData.articles = worldData.articles.filter(function(x){ return x.id!==id; });
      saveData(); closeViews(); renderArticles();
    }
  }
// cerrar las vistas y volver a la lista 
  function closeViews() {
    document.getElementById('wiki-read').classList.add('hidden');
    document.getElementById('wiki-edit').classList.add('hidden');
    document.getElementById('wiki-list').classList.remove('hidden');
  }
// funcion para subir el mapa a la aplicacion (actualizada para un mejor almacenamiento de la imagen)
  
function uploadMap(e) {
  var f = e.target.files[0];
  if (!f) return;

  storeMapImage(f)
      .then(function() {
          worldData.mapImage = null;
          worldData.pins = [];
          saveData();
          renderMap();
          console.log('Nuevo mapa guardado correctamente.');
      })
      .catch(function(error) {
          console.error('Error al guardar el mapa:', error);
          alert('No se pudo guardar el mapa. Comprueba el almacenamiento disponible.');
      })
      .finally(function() {
          e.target.value = '';
      });
}

// funcion que crea el apartado del mapa mundo (actualizada para recuperar la imagen almacenada en el navegador)
  
function renderMap() {
  var img = document.getElementById('map-img');
  var pl = document.getElementById('pins');
  var placeholder = document.getElementById('map-ph');

  pl.innerHTML = '';

  getMapImage()
      .then(function(blob) {
          if (mapObjectUrl) {
              URL.revokeObjectURL(mapObjectUrl);
              mapObjectUrl = null;
          }

          if (!blob) {
              img.classList.add('hidden');
              placeholder.classList.remove('hidden');
              return;
          }

          mapObjectUrl = URL.createObjectURL(blob);
          img.src = mapObjectUrl;
          img.classList.remove('hidden');
          placeholder.classList.add('hidden');

          worldData.pins.forEach(function(p, i) {
              var el = document.createElement('div');

              el.className = 'pin';
              el.style.left = p.x + '%';
              el.style.top = p.y + '%';
              el.innerText = '📍 ' + p.label;

              el.onclick = function(ev) {
                  ev.stopPropagation();

                  var t = worldData.articles.find(function(x) {
                      return x.title.toLowerCase() === p.label.toLowerCase();
                  });

                  if (t) {
                      switchTab('wiki');
                      readArt(t.id);
                  } else {
                      alert('Marcador: ' + p.label);
                  }
              };

              el.oncontextmenu = function(ev) {
                  ev.preventDefault();

                  if (confirm('¿Borrar pin?')) {
                      worldData.pins.splice(i, 1);
                      saveData();
                      renderMap();
                  }
              };

              pl.appendChild(el);
          });
      })
      .catch(function(error) {
          console.error('Error al recuperar el mapa:', error);
          placeholder.classList.remove('hidden');
          placeholder.innerText = 'Error al recuperar el mapa.';
          img.classList.add('hidden');
      });
}

//funcion para añadir pines al mapa
  function addPin(e) {
    var r = e.target.getBoundingClientRect();
    var lbl = prompt('Nombre del lugar:');
    if (lbl && lbl.trim()) {
      worldData.pins.push({ x:(((e.clientX-r.left)/r.width)*100).toFixed(2), y:(((e.clientY-r.top)/r.height)*100).toFixed(2), label:lbl.trim() });
      saveData(); renderMap();
    }
  }
 // funcion que crea el apartado de las lineas temporales 
  function renderTl() {
    var l = document.getElementById('tl-list');
    l.innerHTML = '';
    worldData.timeline.forEach(function(it, i) {
      var d = document.createElement('div'); d.className = 't-item';
      var top = document.createElement('div'); top.style.display = 'flex'; top.style.justifyContent = 'space-between';
      var b = document.createElement('b'); b.style.color = 'var(--accent)'; b.textContent = it.date;
      var btn = document.createElement('button'); btn.style.background = 'none'; btn.style.border = 'none'; btn.style.color = 'var(--danger)'; btn.style.cursor = 'pointer'; btn.textContent = '✖';
      btn.onclick = function() { delTl(i); };
      top.appendChild(b); top.appendChild(btn);
      var h3 = document.createElement('h3'); h3.textContent = it.title;
      var p = document.createElement('p'); p.style.color = 'var(--muted)'; p.textContent = it.desc;
      d.appendChild(top); d.appendChild(h3); d.appendChild(p);
      l.appendChild(d);
    });
  }
// funcion para añadir el apartado de linea de tiempo justo debajo tenemos la de borrar la linea 
  function addTl() {
    var date = document.getElementById('tl-d').value.trim();
    var title = document.getElementById('tl-t').value.trim();
    var desc = document.getElementById('tl-p').value.trim();
    if (!date || !title) return alert('Indica fecha y título.');
    worldData.timeline.push({ id:Date.now().toString(), date:date, title:title, desc:desc });
    saveData();
    ['tl-d','tl-t','tl-p'].forEach(function(k){ document.getElementById(k).value=''; });
    renderTl();
  }

  function delTl(i) { worldData.timeline.splice(i,1); saveData(); renderTl(); }
 // codigo para exportar los datos (actualizando para descargar un zip son el mapa mundo)
  
async function exportData() {
  try {
      var zip = new JSZip();

      // Guardar los datos del mundo sin incluir la imagen.
      zip.file('mi_mundo.json', JSON.stringify(worldData, null, 2));

      // Recuperar la imagen del mapa desde IndexedDB.
      var mapBlob = await getMapImage();

      if (mapBlob) {
        var extension = mapBlob.type.split('/')[1] || 'img';

        if (extension === 'jpeg') extension = 'jpg';
        
        zip.file('mapa.' + extension, mapBlob);
      }

      // Generar el archivo ZIP.
      var contenido = await zip.generateAsync({
          type: 'blob'
      });

      // Descargar el ZIP.
      var url = URL.createObjectURL(contenido);
      var enlace = document.createElement('a');

      enlace.href = url;
      enlace.download = 'LoreForge_Copia.zip';
      enlace.click();

      URL.revokeObjectURL(url);

  } catch (error) {
      console.error('Error al exportar la copia:', error);
      alert('No se pudo crear la copia de seguridad.');
  }
}

// codigo para cargar los datos del json en la aplicacion (ahora tambien del zip)
  
async function importData(e) {
  var f = e.target.files[0];
  if (!f) return;

  try {
      var d;
      var mapBlob = null;
      var isZip = f.name.toLowerCase().endsWith('.zip');

      if (isZip) {
          // Abrir el archivo ZIP.
          var zip = await JSZip.loadAsync(f);

          // Buscar los datos del mundo.
          var jsonFile = zip.file('mi_mundo.json');

          if (!jsonFile) {
              throw new Error('El ZIP no contiene mi_mundo.json.');
          }

          d = JSON.parse(await jsonFile.async('string'));

          // Buscar la imagen del mapa, si existe.
          var mapName = Object.keys(zip.files).find(function(name) {
              return /^mapa\./i.test(name) && !zip.files[name].dir;
          });

          if (mapName) {
            var extension = mapName.split('.').pop().toLowerCase();
        
            var mimeTypes = {
                png: 'image/png',
                jpg: 'image/jpeg',
                jpeg: 'image/jpeg',
                webp: 'image/webp',
                gif: 'image/gif',
                bmp: 'image/bmp',
                svg: 'image/svg+xml'
            };
        
            var mapBytes = await zip.file(mapName).async('uint8array');
        
            mapBlob = new Blob([mapBytes], {
                type: mimeTypes[extension] || 'application/octet-stream'
            });
        }

      } else {
          // Compatibilidad con copias antiguas JSON.
          d = JSON.parse(await f.text());
      }

      // Comprobar que los datos tienen una estructura válida.
      if (!d || !Array.isArray(d.articles)) {
          throw new Error('El archivo no contiene datos válidos de LoreForge.');
      }

      // Evitar errores si faltan estas secciones.
      if (!Array.isArray(d.pins)) d.pins = [];
      if (!Array.isArray(d.timeline)) d.timeline = [];

      // Restaurar la imagen del ZIP o borrar la anterior si no existe.
      if (isZip) {
          if (mapBlob) {
              await storeMapImage(mapBlob);
          } else {
              await deleteMapImage();
          }
      }

      // Sustituir los datos actuales por los importados.
      worldData = d;
      saveData();

      // Si el JSON antiguo contiene un mapa en DataURL, migrarlo.
      if (!isZip && worldData.mapImage) {
          await migrateLegacyMap();
      } else {
          renderMap();
      }

      activeFolder = 'Todas';
      renderArticles();
      renderTl();

      alert('¡Copia de LoreForge restaurada correctamente!');

  } catch (err) {
      console.error('Error al importar la copia:', err);
      alert('No se pudo importar el archivo. Comprueba que sea una copia válida.');
  } finally {
      e.target.value = '';
  }
}


  renderArticles();
  migrateLegacyMap();
