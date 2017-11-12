function createFullSizeIframe() {
  var iframe = document.createElement('iframe');
  iframe.style.background = 'none';
  iframe.style.border = 'none';
  iframe.style.borderRadius = 'none';
  iframe.style.boxShadow = 'none';
  iframe.style.cssFloat = 'none';
  iframe.style.display = 'block';
  iframe.style.height = '100%';
  iframe.style.margin = '0';
  iframe.style.maxHeight = 'none';
  iframe.style.maxWidth = 'none';
  iframe.style.position = 'static';
  iframe.style.transform = 'none';
  iframe.style.visibility = 'visible';
  iframe.style.width = '100%';
  return iframe;
}


skylarkjs.eventer.ready(function(){
  var params = skylarkjs.langx.getQueryParams(),
     slaxUrl = params.file;
  if (!slaxUrl) {
    return;
  }
  slaxUrl = decodeURIComponent(slaxUrl);

  var oReq = new XMLHttpRequest();
  oReq.open("GET", slaxUrl, true);
  oReq.responseType = "blob";

  var d = new skylarkjs.langx.Deferred();

  oReq.onload = function (oEvent) {
    var f = oReq.response; // Note: not oReq.responseText
    if (f) {
          var lfs;
          skylarkjs.storages.localfs.request(1024*1024*10,false).then(function(fs){
              lfs = fs;
              skylarkjs.zip(f) .then(function(zip) {
                var defers = [],
                    appdir = slaxUrl.substring(slaxUrl.lastIndexOf("/")+1)+"/";

                zip.forEach(function (relativePath, zipEntry) {  // 2) print entries
                    var d = new skylarkjs.langx.Deferred();
                    zipEntry.async("arraybuffer").then(function(data){
                      if (!zipEntry.dir) {
                        lfs.writefile(appdir+zipEntry.name,new Blob([data], {type: "application/octet-binary"}),function(r){
                          d.resolve();
                        }, function(e){
                          d.reject(e);
                        });
                      } else {
                        d.resolve();
                      }
                    });
                    defers.push(d.promise);
                });
                skylarkjs.langx.Deferred.all(defers).then(function(){
                  d.resolve(lfs._cwd.toURL()+appdir+"index.html");
                },function(e){
                  console.log(e);
                  d.reject(e);
                });
             });
        }, function (e) {
          console.log(e);
          d.reject(e);
        });
    }
  };

  oReq.send(null);

  d.then(function(slaxAppIndexUrl){
    //var frame = createFullSizeIframe();
    //document.body.appendChild(frame);
    //frame.src = slaxAppIndexUrl;
    document.location.href = slaxAppIndexUrl;
  });
});
