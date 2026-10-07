(() => {
  "use strict";
  const IDS = "http://standards.buildingsmart.org/IDS";
  const XS = "http://www.w3.org/2001/XMLSchema";
  const XSI = "http://www.w3.org/2001/XMLSchema-instance";
  const XMLNS = "http://www.w3.org/2000/xmlns/";
  const INFO_ORDER = ["title", "copyright", "version", "description", "author", "date", "purpose", "milestone"];
  const FACET_ORDER = ["entity", "partOf", "classification", "attribute", "property", "material"];
  const RELATIONS = ["", "IFCRELAGGREGATES", "IFCRELASSIGNSTOGROUP", "IFCRELCONTAINEDINSPATIALSTRUCTURE", "IFCRELNESTS", "IFCRELVOIDSELEMENT IFCRELFILLSELEMENT"];
  const COLORS = [
    {name:"Teal",hex:"#5cc9b7"},{name:"Blue",hex:"#70a8ed"},{name:"Amber",hex:"#e7b458"},
    {name:"Violet",hex:"#b49ae9"},{name:"Coral",hex:"#e69488"},{name:"Mint",hex:"#87cf95"},
    {name:"Rose",hex:"#e783b6"},{name:"Indigo",hex:"#667bd7"},{name:"Orange",hex:"#ed9366"},
    {name:"Lime",hex:"#b4ca63"},{name:"Sky",hex:"#62bedc"},{name:"Slate",hex:"#8297aa"}
  ];
  const IFC_ENTITIES = `IFCAIRTERMINAL IFCANNOTATION IFCBEAM IFCBUILDING IFCBUILDINGELEMENTPROXY IFCBUILDINGSTOREY IFCCABLECARRIERSEGMENT IFCCOLUMN IFCCOVERING IFCCURTAINWALL IFCDISTRIBUTIONBOARD IFCDOOR IFCELECTRICAPPLIANCE IFCELECTRICDISTRIBUTIONBOARD IFCELEMENTASSEMBLY IFCFLOWCONTROLLER IFCFLOWFITTING IFCFLOWMETER IFCFLOWMOVINGDEVICE IFCFLOWSEGMENT IFCFLOWSTORAGEDEVICE IFCFLOWTERMINAL IFCFLOWTREATMENTDEVICE IFCFOOTING IFCFURNISHINGELEMENT IFCFURNITURE IFCGRID IFCMEMBER IFCOPENINGELEMENT IFCPILE IFCPIPEFITTING IFCPIPESEGMENT IFCPLATE IFCPROJECT IFCRAILING IFCRAMP IFCRAMPFLIGHT IFCROOF IFCSANITARYTERMINAL IFCSHADINGDEVICE IFCSITE IFCSLAB IFCSPACE IFCSPATIALZONE IFCSTAIR IFCSTAIRFLIGHT IFCSYSTEM IFCTANK IFCTRANSPORTELEMENT IFCWALL IFCWINDOW IFCZONE`.split(" ");
  const IFC_ATTRIBUTES = `Name Description ObjectType LongName Phase LandTitleNumber Elevation RefLatitude RefLongitude CompositionType PredefinedType Tag GlobalId`.split(" ");
  const IFC_DATA_TYPES = `IFCLABEL IFCIDENTIFIER IFCTEXT IFCBOOLEAN IFCLOGICAL IFCINTEGER IFCREAL IFCPOSITIVELENGTHMEASURE IFCLENGTHMEASURE IFCAREAMEASURE IFCVOLUMEMEASURE IFCMASSMEASURE IFCTHERMALTRANSMITTANCEMEASURE IFCDATETIME IFCDATE IFCTIME IFCURIREFERENCE IFCCOUNTMEASURE IFCRATIOMEASURE`.split(" ");
  const SETUP_ITEMS = [
    {id:"project-name",title:"Project name or number",entity:"IFCPROJECT",kind:"attribute",name:"Name",level:"yes",note:"Checks IfcProject.Name."},
    {id:"project-phase",title:"Project phase",entity:"IFCPROJECT",kind:"attribute",name:"Phase",level:"yes",note:"IfcProject inherits the optional Phase attribute; add this check when your handover requires a value."},
    {id:"site-name",title:"Site name",entity:"IFCSITE",kind:"attribute",name:"Name",level:"yes",note:"Checks IfcSite.Name."},
    {id:"building-name",title:"Building name",entity:"IFCBUILDING",kind:"attribute",name:"Name",level:"yes",note:"Checks IfcBuilding.Name."},
    {id:"building-id",title:"Building identifier",entity:"IFCBUILDING",kind:"property",pset:"Pset_BuildingCommon",name:"BuildingID",level:"yes",note:"Checks the building ID property."},
    {id:"storey-name",title:"Storey number or name",entity:"IFCBUILDINGSTOREY",kind:"attribute",name:"Name",level:"yes",note:"Checks IfcBuildingStorey.Name."},
    {id:"space-name",title:"Space number or name",entity:"IFCSPACE",kind:"attribute",name:"Name",level:"yes",note:"Checks IfcSpace.Name."},
    {id:"site-hierarchy",title:"Site belongs to project",entity:"IFCSITE",kind:"partOf",parent:"IFCPROJECT",relation:"IFCRELAGGREGATES",level:"partly",note:"Checks the selected aggregation relationship."},
    {id:"building-hierarchy",title:"Building belongs to site",entity:"IFCBUILDING",kind:"partOf",parent:"IFCSITE",relation:"IFCRELAGGREGATES",level:"partly",note:"Checks the selected aggregation relationship."},
    {id:"storey-hierarchy",title:"Storey belongs to building",entity:"IFCBUILDINGSTOREY",kind:"partOf",parent:"IFCBUILDING",relation:"IFCRELAGGREGATES",level:"partly",note:"Checks the selected aggregation relationship."},
    {id:"space-hierarchy",title:"Space belongs to storey",entity:"IFCSPACE",kind:"partOf",parent:"IFCBUILDINGSTOREY",relation:"IFCRELAGGREGATES",level:"partly",note:"Checks the selected aggregation relationship."},
    {id:"crs",title:"Projected CRS and coordinates",level:"no",note:"IfcProjectedCRS and coordinate values need an IFC model check."},
    {id:"map",title:"Map conversion",level:"no",note:"IfcMapConversion parameters need an IFC model check."},
    {id:"units",title:"Project units",level:"no",note:"IfcUnitAssignment needs an IFC model check."},
    {id:"north",title:"True north",level:"no",note:"Direction and placement values need an IFC model check."}
  ];
  const $ = (selector) => document.querySelector(selector);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  let xml, selected = 0, editIndex = null, fileName = "requirements.ids", dirty = false, checkState = null, toastTimer;
  let files = [], active = -1, sequence = 0;
  const picked = new Set();

  function children(parent, name) { return [...(parent?.children || [])].filter(n => n.namespaceURI === IDS && (!name || n.localName === name)); }
  function child(parent, name) { return children(parent, name)[0] || null; }
  function node(name) { return xml.createElementNS(IDS, `ids:${name}`); }
  function simple(parent, name, value) { const el = node(name), sv = node("simpleValue"); sv.textContent = value; el.appendChild(sv); parent.appendChild(el); return el; }
  function simpleText(parent, name) { return child(child(parent, name), "simpleValue")?.textContent || ""; }
  function specsFor(doc) { return children(child(doc?.documentElement, "specifications"), "specification"); }
  function specs() { return specsFor(xml); }
  function current() { return specs()[selected] || null; }
  function requirements(spec = current()) { return children(child(spec, "requirements")); }
  function activeFile() { return files[active] || null; }
  function markDirty({setup=true}={}) { dirty = true; checkState = null; if (activeFile()) { activeFile().dirty=true; activeFile().checkState=null; } updateHeader(); renderChecks(); renderSidebar(); if (setup) renderSetup(); }

  function createDocument(title="Untitled information requirements") {
    const doc = document.implementation.createDocument(IDS, "ids:ids", null);
    const root = doc.documentElement;
    root.setAttributeNS(XMLNS,"xmlns:ids",IDS);
    root.setAttributeNS(XMLNS,"xmlns:xs",XS);
    root.setAttributeNS(XMLNS,"xmlns:xsi",XSI);
    root.setAttributeNS(XSI, "xsi:schemaLocation", `${IDS} https://standards.buildingsmart.org/IDS/1.0/ids.xsd`);
    const info=doc.createElementNS(IDS,"ids:info"), titleNode=doc.createElementNS(IDS,"ids:title");
    titleNode.textContent=title; info.appendChild(titleNode); root.appendChild(info);
    root.appendChild(doc.createElementNS(IDS,"ids:specifications"));
    return doc;
  }

  function uniqueName(name) {
    const normalized=name.toLowerCase().endsWith(".ids")?name:`${name}.ids`;
    if (!files.some(f=>f.name.toLowerCase()===normalized.toLowerCase())) return normalized;
    const stem=normalized.slice(0,-4); let n=2;
    while (files.some(f=>f.name.toLowerCase()===`${stem}_${n}.ids`.toLowerCase())) n++;
    return `${stem}_${n}.ids`;
  }
  function openDocument(doc,name,{replaceBlank=false,sample=false}={}) {
    const old=files.length===1 && !files[0].dirty && files[0].name==="requirements.ids" && !specsFor(files[0].doc).length;
    if (replaceBlank && old) { files=[]; active=-1; picked.clear(); }
    const entry={id:++sequence,doc,name:uniqueName(name),color:COLORS[files.length%COLORS.length].hex,selected:0,dirty:false,checkState:null,sample};
    files.push(entry); activate(files.length-1); return entry;
  }
  function activate(index,specIndex=null) {
    if (activeFile()) { activeFile().selected=selected; activeFile().dirty=dirty; activeFile().checkState=checkState; }
    active=index; const f=activeFile(); if (!f) return;
    xml=f.doc; fileName=f.name; selected=specIndex===null?f.selected:specIndex; dirty=f.dirty; checkState=f.checkState;
    render();
  }

  function emptyDoc() {
    return openDocument(createDocument(),"requirements.ids");
  }

  function clearWorkspace() {
    files=[]; active=-1; xml=null; selected=0; fileName=""; dirty=false; checkState=null; picked.clear();
    $("#spec-search").value="";
    render();
  }

  function removeFile(index) {
    const file=files[index]; if (!file) return;
    if (file.dirty && !confirm(`Remove ${file.name}? Its browser edits have not been downloaded.`)) return;
    const wasActive=index===active;
    files.splice(index,1);
    for (const key of [...picked]) if (key.startsWith(`${file.id}:`)) picked.delete(key);
    if (!files.length) clearWorkspace();
    else if (wasActive) { active=-1; activate(Math.min(index,files.length-1)); }
    else { if (index<active) active--; render(); }
    toast(`${file.name} removed from the builder`);
  }

  function removeAllFiles() {
    if (!files.length) return;
    const unsaved=files.filter(f=>f.dirty).length;
    if (unsaved && !confirm(`Clear all ${files.length} IDS files? ${unsaved} file${unsaved===1?" has":"s have"} browser edits that have not been downloaded.`)) return;
    clearWorkspace(); toast("IDS builder cleared");
  }

  function loadXml(text, name) {
    const parsed = new DOMParser().parseFromString(text, "application/xml");
    const error = parsed.querySelector("parsererror");
    if (error || parsed.documentElement?.namespaceURI !== IDS || parsed.documentElement?.localName !== "ids") {
      throw new Error(error?.textContent?.slice(0, 180) || "This is not an IDS 1.0 XML file.");
    }
    if (!child(parsed.documentElement, "info") || !child(parsed.documentElement, "specifications")) {
      throw new Error("The IDS file needs info and specifications sections.");
    }
    const entry=openDocument(parsed,name || "requirements.ids",{replaceBlank:true});
    runChecks(); toast(`Opened ${entry.name}`);
    return entry;
  }

  function updateHeader() {
    const list = specs(), ruleCount = list.reduce((sum, s) => sum + requirements(s).length, 0);
    $("#metric-specs").textContent = list.length;
    $("#metric-rules").textContent = ruleCount;
    $("#metric-classes").textContent = new Set(list.map(s => simpleText(child(s,"applicability")?.firstElementChild,"name")).filter(Boolean)).size;
    $("#file-count").textContent = files.length;
    $("#file-state").textContent = activeFile() ? `${fileName}${dirty ? " · Unsaved" : ""}` : "No IDS file open";
    $("#metric-checks").textContent = checkState === null ? "—" : checkState.errors ? `${checkState.errors} issue${checkState.errors === 1 ? "" : "s"}` : "Passed";
    $("#extract-count").textContent = picked.size;
    $("#extract-selected").disabled = picked.size===0;
    $("#clear-all").disabled = files.length===0;
    $("#add-spec").disabled = files.length===0;
    $("#spec-search").disabled = files.length===0;
    $("#preview-file").disabled = files.length===0;
    $("#export-file").disabled = files.length===0;
    $("#export-all").disabled = files.length===0;
    $("#run-checks").disabled = files.length===0;
    $("#jump-setup").disabled = files.length===0;
  }

  function renderInfo() {
    const info = child(xml?.documentElement, "info");
    document.querySelectorAll("[data-info]").forEach(input => {
      input.value = child(info, input.dataset.info)?.textContent || "";
      input.disabled = !activeFile();
    });
  }

  function renderSidebar() {
    const query = $("#spec-search").value.trim().toLowerCase();
    $("#file-list").innerHTML = files.map((f, fileIndex) => {
      const all=specsFor(f.doc), filenameMatch=f.name.toLowerCase().includes(query);
      const matching=all.map((s,index)=>({s,index})).filter(({s})=>{
        const entity=simpleText(child(child(s,"applicability"),"entity"),"name");
        return !query || filenameMatch || `${entity} ${s.getAttribute("name")||""}`.toLowerCase().includes(query);
      });
      if (query && !matching.length && !filenameMatch) return "";
      const expanded=fileIndex===active || Boolean(query);
      const rows=expanded ? matching.map(({s,index})=>{
        const entity=simpleText(child(child(s,"applicability"),"entity"),"name");
        const key=`${f.id}:${index}`;
        return `<div class="spec-row ${fileIndex===active && selected===index?"active":""}"><input class="spec-pick" type="checkbox" data-pick="${esc(key)}" aria-label="Select ${esc(entity||s.getAttribute("name")||"specification")} for extraction" ${picked.has(key)?"checked":""}><button class="spec-link" type="button" data-select-file="${fileIndex}" data-select-spec="${index}" title="${esc(s.getAttribute("name")||entity)}">${esc(entity || s.getAttribute("name") || "Unnamed specification")}</button></div>`;
      }).join("") : "";
      return `<div class="file-group" style="--file-color:${f.color}"><div class="file-group-title"><button class="file-group-head ${fileIndex===active?"active":""}" type="button" data-open-file="${fileIndex}" title="${esc(f.name)}"><span class="file-swatch"></span><span class="file-name">${esc(f.name)}</span><span class="file-meta">${all.length} ${expanded?"▾":"▸"}</span></button><button class="file-remove" type="button" data-remove-file="${fileIndex}" aria-label="Remove ${esc(f.name)} from builder" title="Remove from builder">×</button></div><div class="file-specs">${rows}</div></div>`;
    }).join("") || `<div class="empty-state">${files.length?"No matching IDS files.":"No IDS files open. Create or import one."}</div>`;
  }

  function collectOptions() {
    const entities=new Set(IFC_ENTITIES), attributes=new Set(IFC_ATTRIBUTES), psets=new Set(["NONS_Reference","NONS_Process","Pset_BuildingCommon","Pset_BuildingStoreyCommon","Pset_SpaceCommon","Pset_WallCommon","Pset_DoorCommon","Pset_WindowCommon"]), properties=new Set(), datatypes=new Set(IFC_DATA_TYPES), classifications=new Set(["Uniclass 2015","NS 3451","NS 3457-8"]);
    for (const f of files) for (const s of specsFor(f.doc)) {
      const entity=simpleText(child(child(s,"applicability"),"entity"),"name"); if (entity) entities.add(entity);
      for (const facet of requirements(s)) {
        if (facet.localName==="attribute") attributes.add(simpleText(facet,"name"));
        if (facet.localName==="property") { psets.add(simpleText(facet,"propertySet")); properties.add(simpleText(facet,"baseName")); if (facet.getAttribute("dataType")) datatypes.add(facet.getAttribute("dataType")); }
        if (facet.localName==="classification") classifications.add(simpleText(facet,"system"));
      }
    }
    const fill=(id,items)=>{ $(id).innerHTML=[...items].filter(Boolean).sort().map(v=>`<option value="${esc(v)}"></option>`).join(""); };
    fill("#entity-options",entities); fill("#attribute-options",attributes); fill("#pset-options",psets); fill("#property-options",properties); fill("#datatype-options",datatypes); fill("#classification-options",classifications);
  }

  function renderActiveFileBar() {
    const f=activeFile();
    $("#active-file-bar").hidden=!f;
    if (!f) { $("#active-file-bar").innerHTML=""; return; }
    $("#active-file-bar").style.setProperty("--file-color",f.color);
    const currentColor=COLORS.find(c=>c.hex.toLowerCase()===f.color.toLowerCase())?.name || "Custom";
    $("#active-file-bar").innerHTML=`<span class="file-swatch-large"></span><label for="file-name-input">Current IDS</label><input id="file-name-input" value="${esc(f.name)}" aria-label="Current IDS file name"><details class="color-picker"><summary aria-label="Choose IDS file color"><span class="color-preview" style="background:${f.color}"></span>Color: ${currentColor}</summary><div class="color-menu"><div class="color-menu-title">Choose a file color</div><div class="color-grid">${COLORS.map(c=>`<button type="button" class="color-tile ${f.color.toLowerCase()===c.hex.toLowerCase()?"selected":""}" data-file-color="${c.hex}" title="${c.name}" aria-label="${c.name}" aria-pressed="${f.color.toLowerCase()===c.hex.toLowerCase()}"><span style="background:${c.hex}"></span></button>`).join("")}</div><label class="custom-color">Custom color <input id="custom-file-color" type="color" value="${f.color}" aria-label="Custom IDS file color"></label></div></details><small>${specs().length} specifications</small><button id="close-file" class="button ghost small" type="button">Close</button>`;
  }

  function setFileColor(color) {
    if (!/^#[0-9a-f]{6}$/i.test(color)) return;
    const f=activeFile(); if (!f) return;
    f.color=color;
    renderSidebar(); renderActiveFileBar();
  }

  function setupSpec(item) { return specs().find(s=>simpleText(child(child(s,"applicability"),"entity"),"name")===item.entity); }
  function hasSetupCheck(item) {
    const s=setupSpec(item); if (!s) return false;
    return requirements(s).some(f=>{
      if (f.localName!==item.kind) return false;
      if (item.kind==="attribute") return simpleText(f,"name")===item.name;
      if (item.kind==="property") return simpleText(f,"propertySet")===item.pset && simpleText(f,"baseName")===item.name;
      if (item.kind==="partOf") return simpleText(child(f,"entity"),"name")===item.parent && (f.getAttribute("relation")||"")===item.relation;
      return false;
    });
  }
  function renderSetup() {
    if (!activeFile()) { $("#setup-content").innerHTML=`<div class="empty-state">Open or create an IDS file to add project and model setup checks.</div>`; return; }
    $("#setup-content").innerHTML=`<div class="setup-intro">These rows describe model setup, with what IDS 1.0 can check. “Partly” means IDS can check a specific relationship, while a complete model setup review still needs an IFC validator.</div><div class="setup-grid">${SETUP_ITEMS.map(item=>{
      const present=item.level!=="no" && hasSetupCheck(item);
      const status=item.level==="yes"?"Yes":item.level==="partly"?"Partly":"No direct IDS check";
      const target=item.entity?`${item.entity}${item.kind==="property"?`.${item.pset}.${item.name}`:item.kind==="attribute"?`.${item.name}`:` → ${item.parent}`}`:"IFC model check";
      return `<div class="setup-item"><div class="setup-item-main"><h3>${esc(item.title)}</h3><p>${esc(item.note)}</p><code>${esc(target)}</code><div class="setup-state ${present?"":"missing"}">${item.level==="no"?"Use IFC validation":present?"Included in current IDS":"Not in current IDS"}</div></div><div><span class="setup-status ${item.level}">${status}</span>${item.level!=="no"?`<div style="margin-top:10px"><button type="button" data-setup="${item.id}">${present?"Open":"Add check"}</button></div>`:""}</div></div>`;
    }).join("")}</div>`;
  }

  function renderSpec() {
    const spec = current();
    const chosenEntity=spec ? simpleText(child(child(spec,"applicability"),"entity"),"name") : "";
    $("#selected-heading").textContent = chosenEntity || spec?.getAttribute("name") || "Select a specification";
    $("#selected-subtitle").textContent = spec ? `${spec.getAttribute("name")||"Unnamed"} · ${spec.getAttribute("identifier") || "No identifier"} · ${spec.getAttribute("ifcVersion") || "No IFC version"}` : activeFile() ? "Choose one on the left or add a new one." : "Open or create an IDS file.";
    if (!spec) { $("#spec-editor").innerHTML = `<div class="empty-state">${activeFile()?"Add a specification to begin defining IFC requirements.":"Open or create an IDS file to begin."}</div>`; return; }
    const app = child(spec,"applicability"), entity = child(app,"entity");
    const extraApp = children(app).filter(n => n !== entity).length;
    $("#spec-editor").innerHTML = `<div class="spec-fields">
      <label class="field span-2">Specification name <input data-spec="name" value="${esc(spec.getAttribute("name"))}"></label>
      <label class="field">Identifier <input data-spec="identifier" value="${esc(spec.getAttribute("identifier"))}"></label>
      <label class="field span-2">Description <input data-spec="description" value="${esc(spec.getAttribute("description"))}"></label>
      <label class="field">IFC version <select data-spec="ifcVersion">${[...new Set(["IFC4","IFC4X3_ADD2","IFC2X3",spec.getAttribute("ifcVersion")].filter(Boolean))].map(v=>`<option value="${esc(v)}" ${spec.getAttribute("ifcVersion")===v?"selected":""}>${esc(v)}</option>`).join("")}</select></label>
      <label class="field">Applicable IFC entity <input data-spec="entity" list="entity-options" value="${esc(simpleText(entity,"name"))}" placeholder="Choose or enter IFC entity"></label>
      <label class="field">Minimum occurrences <input data-spec="minOccurs" type="number" min="0" value="${esc(app?.getAttribute("minOccurs") || "0")}"></label>
      <label class="field">Maximum occurrences <input data-spec="maxOccurs" list="max-occurs-options" value="${esc(app?.getAttribute("maxOccurs") || "unbounded")}" placeholder="Choose or enter a number"></label>
    </div><div class="spec-actions"><div class="scope-note">Applicability: <strong>${esc(simpleText(entity,"name") || "No IFC entity")}</strong>${extraApp ? ` · ${extraApp} additional applicability facet${extraApp===1?"":"s"} preserved in XML` : ""}</div><button id="delete-spec" class="button danger small" type="button">Delete specification</button></div>`;
  }

  function readValue(facet, name) {
    const holder = child(facet, name);
    if (!holder) return {mode:"none",value:""};
    const sv = child(holder,"simpleValue");
    if (sv) return {mode:"exact",value:sv.textContent || ""};
    const restriction = [...holder.children].find(n=>n.namespaceURI===XS && n.localName==="restriction");
    if (!restriction) return {mode:"advanced",value:""};
    const parts = [...restriction.children];
    if (parts.length === 1 && parts[0].localName === "pattern") return {mode:"pattern",value:parts[0].getAttribute("value") || ""};
    if (parts.length && parts.every(n=>n.localName==="enumeration")) return {mode:"list",value:parts.map(n=>n.getAttribute("value")).join("\n")};
    return {mode:"advanced",value:""};
  }

  function facetLabel(f) {
    switch (f.localName) {
      case "property": return `${simpleText(f,"propertySet")}.${simpleText(f,"baseName")}`;
      case "attribute": return simpleText(f,"name");
      case "entity": return simpleText(f,"name");
      case "classification": return `${simpleText(f,"system")}${simpleText(f,"value") ? ` · ${simpleText(f,"value")}` : ""}`;
      case "partOf": return simpleText(child(f,"entity"),"name");
      case "material": return readValue(f,"value").value || "Material";
      default: return f.localName;
    }
  }
  function facetValue(f) {
    const value = readValue(f,"value");
    if (value.mode === "none") return "Presence only";
    if (value.mode === "exact") return `= ${value.value}`;
    if (value.mode === "pattern") return `Pattern: ${value.value}`;
    if (value.mode === "list") return `One of: ${value.value.replaceAll("\n", ", ")}`;
    return "Advanced value rule";
  }
  function splitSampleInstructions(instructions="") {
    const current=instructions.match(/^Sample Value:\s*(.*?)\s*\[illustrative\](?:\s*\|\s*)?/i);
    if (current) return {sample:current[1].trim(),instructions:instructions.slice(current[0].length).trim()};
    const legacy=/(?:\.\s*)?Illustrative workbook example:\s*(.*?)\s*\(not an exact required value\)\.?\s*/i.exec(instructions);
    if (legacy) {
      const before=instructions.slice(0,legacy.index).trim().replace(/[.;]\s*$/,""), after=instructions.slice(legacy.index+legacy[0].length).trim();
      return {sample:legacy[1].trim(),instructions:[before,after].filter(Boolean).join(before&&after?". ":"")};
    }
    return {sample:"",instructions};
  }
  function facetSample(f) {
    return splitSampleInstructions(f.getAttribute("instructions") || "").sample;
  }

  function updateRequirementScope() {
    const spec=current(), scope=$("#requirements-scope");
    if (!spec) { scope.textContent="Select a specification to see which IFC objects these requirements apply to."; return; }
    const app=child(spec,"applicability"), entity=child(app,"entity");
    const name=simpleText(entity,"name") || "IFC entity not set";
    const version=spec.getAttribute("ifcVersion") || "IFC version not set";
    const min=app?.getAttribute("minOccurs") || "0", max=app?.getAttribute("maxOccurs") || "unbounded";
    const extra=children(app).filter(f=>f!==entity).length;
    scope.textContent=`Applies to ${name} · ${version} · ${min}–${max} occurrences${extra?` · plus ${extra} additional applicability filter${extra===1?"":"s"}`:""}`;
  }

  function renderRequirements() {
    const spec = current(), count = requirements(spec).length;
    $("#selected-rule-count").textContent = count;
    updateRequirementScope();
    if (!spec) { $("#requirements-content").innerHTML = `<div class="empty-state">Select a specification to review its requirements.</div>`; return; }
    $("#requirements-content").innerHTML = `<div class="requirements-tools"><input id="rule-search" type="search" placeholder="Find property, sample or source…" aria-label="Find requirements"><button id="add-rule" class="button primary" type="button">＋ Add requirement</button></div><div class="table-scroll"><table><thead><tr><th>Facet</th><th>Information requirement</th><th>Sample value</th><th>Value rule</th><th>Cardinality</th><th></th></tr></thead><tbody id="rule-rows"></tbody></table></div>`;
    renderRuleRows();
  }
  function renderRuleRows() {
    const query = $("#rule-search")?.value.trim().toLowerCase() || "";
    const rows = requirements().map((f, index) => {
      const label = facetLabel(f), instructions = f.getAttribute("instructions") || "", sample=facetSample(f);
      if (query && !`${f.localName} ${label} ${sample} ${instructions}`.toLowerCase().includes(query)) return "";
      const source= instructions.match(/\|\s*Source:\s*([^|]+)/)?.[1]?.trim();
      const meta = f.localName === "property" ? f.getAttribute("dataType") || "Data type unrestricted" : source ? `Source: ${source}` : instructions.split(". ")[0];
      return `<tr><td><span class="facet-kind ${esc(f.localName)}">${esc(f.localName)}</span></td><td><div class="facet-name">${esc(label)}</div><div class="facet-meta" title="${esc(instructions)}">${esc(meta)}</div></td><td class="sample-value" title="Illustrative example; see Value rule for enforced values">${sample?esc(sample):'<span class="text-muted">—</span>'}</td><td class="value-text">${esc(facetValue(f))}</td><td>${esc(f.getAttribute("cardinality") || "required")}</td><td class="row-actions"><button type="button" data-edit="${index}">Edit</button><button type="button" data-remove="${index}">Delete</button></td></tr>`;
    }).join("");
    $("#rule-rows").innerHTML = rows || `<tr><td colspan="6" class="empty-state">No matching requirements.</td></tr>`;
  }

  function render() { updateHeader(); collectOptions(); renderActiveFileBar(); renderInfo(); renderSidebar(); renderSetup(); renderSpec(); renderRequirements(); renderChecks(); }
  function renderChecks() {
    if (!checkState) { $("#check-results").textContent = "Checks have not run yet."; return; }
    const {errors,warnings,messages} = checkState;
    $("#check-results").innerHTML = `<div class="${errors ? "check-error" : warnings ? "check-warn" : "check-good"}">${errors ? `${errors} issue${errors===1?"":"s"} to fix` : warnings ? `No blocking issues · ${warnings} review note${warnings===1?"":"s"}` : "All builder checks passed"}</div><ul>${messages.map(m=>`<li>${esc(m)}</li>`).join("")}</ul>`;
  }

  function setInfo(key, value) {
    const info = child(xml.documentElement,"info"); let target = child(info,key);
    if (!value && key !== "title") { target?.remove(); markDirty({setup:false}); return; }
    if (!target) {
      target = node(key);
      const next = children(info).find(n=>INFO_ORDER.indexOf(n.localName)>INFO_ORDER.indexOf(key));
      info.insertBefore(target,next || null);
    }
    target.textContent = value; markDirty({setup:false});
  }
  function setSpecField(key,value,live=false) {
    const spec = current(); if (!spec) return;
    const app = child(spec,"applicability");
    if (key === "entity") {
      let entity = child(app,"entity"); if (!entity) { entity=node("entity"); app.insertBefore(entity,app.firstElementChild); }
      child(entity,"name")?.remove(); entity.insertBefore(simple(entity,"name",value.toUpperCase()),entity.firstChild);
    } else if (key === "minOccurs" || key === "maxOccurs") app.setAttribute(key,value);
    else if (value || ["name","ifcVersion","identifier"].includes(key)) spec.setAttribute(key,value);
    else spec.removeAttribute(key);
    markDirty({setup:!live});
    if (["entity","ifcVersion","minOccurs","maxOccurs"].includes(key)) updateRequirementScope();
    if (!live) renderSpec();
  }
  function insertFacet(reqs,facet) {
    const rank=FACET_ORDER.indexOf(facet.localName);
    const before=children(reqs).find(n=>FACET_ORDER.indexOf(n.localName)>rank);
    reqs.insertBefore(facet,before||null);
  }
  function addSpecFor(entityName="IFCWALL") {
    const list = specs(), spec = node("specification");
    const number = list.length + 1;
    spec.setAttribute("name",`Requirements — ${entityName}`);
    spec.setAttribute("identifier",`SPEC-${String(activeFile().id).padStart(2,"0")}-${String(number).padStart(3,"0")}`);
    spec.setAttribute("ifcVersion",list[0]?.getAttribute("ifcVersion") || "IFC4");
    const app = node("applicability"); app.setAttribute("minOccurs","0"); app.setAttribute("maxOccurs","unbounded");
    const entity=node("entity"); simple(entity,"name",entityName); app.appendChild(entity); spec.appendChild(app);
    spec.appendChild(node("requirements"));
    child(xml.documentElement,"specifications").appendChild(spec);
    selected = list.length; markDirty(); render(); return spec;
  }
  function addSpec() { addSpecFor(); toast("Specification added"); }
  function addSetupCheck(item) {
    let spec=setupSpec(item);
    if (!spec) spec=addSpecFor(item.entity);
    selected=specs().indexOf(spec);
    if (hasSetupCheck(item)) { render(); $(".specification-card").scrollIntoView({behavior:"smooth",block:"start"}); toast("Opened the specification containing this setup check."); return; }
    const facet=node(item.kind); facet.setAttribute("cardinality","required");
    facet.setAttribute("instructions",`Project and model setup: ${item.title}. ${item.note}`);
    if (item.kind==="attribute") simple(facet,"name",item.name);
    if (item.kind==="property") { simple(facet,"propertySet",item.pset); simple(facet,"baseName",item.name); }
    if (item.kind==="partOf") { facet.setAttribute("relation",item.relation); const parent=node("entity"); simple(parent,"name",item.parent); facet.appendChild(parent); }
    insertFacet(child(spec,"requirements"),facet);
    markDirty(); render(); $(".specification-card").scrollIntoView({behavior:"smooth",block:"start"}); toast(`${item.title} check added`);
  }
  function extractSelected() {
    const selectedSpecs=[];
    for (const f of files) for (const [index,s] of specsFor(f.doc).entries()) if (picked.has(`${f.id}:${index}`)) selectedSpecs.push(s);
    if (!selectedSpecs.length) return;
    const doc=createDocument("Extracted information requirements");
    const info=child(doc.documentElement,"info");
    const description=doc.createElementNS(IDS,"ids:description"); description.textContent=`${selectedSpecs.length} specifications extracted from the open IDS files.`; info.appendChild(description);
    const container=child(doc.documentElement,"specifications");
    for (const s of selectedSpecs) container.appendChild(doc.importNode(s,true));
    picked.clear(); const f=openDocument(doc,"Extracted_Requirements.ids");
    f.dirty=true; dirty=true; runChecks(); render(); toast(`Created ${f.name} with ${selectedSpecs.length} specifications`);
  }

  function field(label,name,value="",opts={}) {
    const className = opts.wide ? "field span-2" : "field";
    const hint = opts.hint ? `<p class="dialog-hint">${esc(opts.hint)}</p>` : "";
    if (opts.options) return `<label class="${className}">${esc(label)}<select name="${esc(name)}">${opts.options.map(o=>`<option value="${esc(o)}" ${String(value)===String(o)?"selected":""}>${esc(o || "None")}</option>`).join("")}</select>${hint}</label>`;
    if (opts.textarea) return `<label class="${className}">${esc(label)}<textarea name="${esc(name)}" rows="${opts.rows||3}">${esc(value)}</textarea>${hint}</label>`;
    return `<label class="${className}">${esc(label)}<input name="${esc(name)}" value="${esc(value)}" ${opts.list?`list="${esc(opts.list)}"`:""} ${opts.placeholder?`placeholder="${esc(opts.placeholder)}"`:""}>${hint}</label>`;
  }
  function facetEditable(f) {
    if (!FACET_ORDER.includes(f.localName)) return false;
    for (const holder of children(f)) {
      if (!["value","name","propertySet","baseName","system","predefinedType"].includes(holder.localName)) continue;
      const mode=readValue(f,holder.localName).mode;
      if (mode === "advanced") return false;
      if (holder.localName !== "value" && mode !== "exact") return false;
    }
    if (f.localName === "partOf" && child(child(f,"entity"),"predefinedType")) return false;
    return true;
  }
  function openFacet(index=null) {
    editIndex=index;
    const f=index === null ? null : requirements()[index];
    if (f && !facetEditable(f)) { toast("This facet uses advanced XML. It is preserved on export but cannot be edited here."); return; }
    $("#dialog-title").textContent=f ? "Edit requirement" : "Add requirement";
    const kind=f?.localName || "property";
    $("#dialog-fields").innerHTML = field("Facet type","kind",kind,{options:FACET_ORDER}) + `<div id="kind-fields" class="span-2"></div>`;
    fillFacetFields(f); $("#facet-dialog").showModal();
  }
  function fillFacetFields(f=null) {
    const kind=$("[name=kind]").value;
    const cardinality=f?.getAttribute("cardinality") || $("#kind-fields [name=cardinality]")?.value || "required";
    const authoring=f ? splitSampleInstructions(f.getAttribute("instructions") || "") : {
      sample:$("#kind-fields [name=sampleValue]")?.value || "",
      instructions:$("#kind-fields [name=instructions]")?.value || ""
    };
    let html="";
    if (kind==="entity") html+=field("IFC entity","entityName",f?simpleText(f,"name"):"",{placeholder:"Choose or enter IFC entity",list:"entity-options"})+field("Predefined type","predefinedType",f?simpleText(f,"predefinedType"):"",{placeholder:"Choose or enter value",list:"predefined-options"});
    if (kind==="partOf") html+=field("Parent IFC entity","parentEntity",f?simpleText(child(f,"entity"),"name"):"",{placeholder:"Choose or enter IFC entity",list:"entity-options"})+field("Relationship","relation",f?.getAttribute("relation")||"",{options:RELATIONS});
    if (kind==="classification") html+=field("Classification system","system",f?simpleText(f,"system"):"",{placeholder:"Choose or enter system",list:"classification-options"})+field("Classification code","classificationValue",f?simpleText(f,"value"):"",{placeholder:"Optional"});
    if (kind==="attribute") html+=field("IFC attribute","attributeName",f?simpleText(f,"name"):"",{placeholder:"Choose or enter attribute",list:"attribute-options"});
    if (kind==="property") html+=field("Property set","propertySet",f?simpleText(f,"propertySet"):"",{placeholder:"Choose or enter property set",list:"pset-options"})+field("Property name","baseName",f?simpleText(f,"baseName"):"",{placeholder:"Choose or enter property",list:"property-options"})+field("IFC data type","dataType",f?.getAttribute("dataType")||"",{placeholder:"Choose data type · optional",list:"datatype-options"});
    if (["attribute","property","material"].includes(kind)) {
      const rule=readValue(f,"value");
      html+=field("Value rule","valueMode",rule.mode,{options:["none","exact","pattern","list"]})+field("Value, pattern or allowed values","valueText",rule.value,{textarea:true,wide:true,hint:"For a list, put one allowed value on each line. Pattern uses XML Schema regular expression syntax."});
    }
    if (kind!=="entity") html+=field("Cardinality","cardinality",cardinality,{options:kind==="partOf"?["required","prohibited"]:["required","optional","prohibited"]});
    html+=field("Sample value (illustrative)","sampleValue",authoring.sample,{wide:true,placeholder:"e.g. REI60",hint:"Example for the model author. This does not enforce the value; use Value rule for that."});
    html+=field("Authoring instructions","instructions",authoring.instructions,{textarea:true,wide:true,rows:3});
    $("#kind-fields").innerHTML=html;
  }

  function addValue(holder,name,mode,value) {
    if (mode==="none") return;
    if (!value.trim()) throw new Error("Enter a value for the selected value rule.");
    if (mode==="exact") { simple(holder,name,value.trim()); return; }
    const wrapper=node(name), restriction=xml.createElementNS(XS,"xs:restriction"); restriction.setAttribute("base","xs:string");
    if (mode==="pattern") { const pattern=xml.createElementNS(XS,"xs:pattern"); pattern.setAttribute("value",value.trim()); restriction.appendChild(pattern); }
    if (mode==="list") {
      const items=value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
      if (!items.length) throw new Error("Add at least one allowed value.");
      for (const item of items) { const choice=xml.createElementNS(XS,"xs:enumeration"); choice.setAttribute("value",item); restriction.appendChild(choice); }
    }
    wrapper.appendChild(restriction); holder.appendChild(wrapper);
  }
  function value(form,key) { return String(form.get(key)||"").trim(); }
  function buildFacet(form) {
    const kind=value(form,"kind"), facet=node(kind);
    if (kind!=="entity") facet.setAttribute("cardinality",value(form,"cardinality")||"required");
    const sample=value(form,"sampleValue"), notes=value(form,"instructions");
    const instructions=sample?`Sample Value: ${sample} [illustrative]${notes?` | ${notes}`:""}`:notes;
    if (instructions) facet.setAttribute("instructions",instructions);
    if (kind==="entity") {
      if (!value(form,"entityName")) throw new Error("Enter an IFC entity.");
      simple(facet,"name",value(form,"entityName").toUpperCase());
      if (value(form,"predefinedType")) simple(facet,"predefinedType",value(form,"predefinedType").toUpperCase());
    } else if (kind==="partOf") {
      if (!value(form,"parentEntity")) throw new Error("Enter a parent IFC entity.");
      const entity=node("entity"); simple(entity,"name",value(form,"parentEntity").toUpperCase()); facet.appendChild(entity);
      if (value(form,"relation")) facet.setAttribute("relation",value(form,"relation"));
    } else if (kind==="classification") {
      if (!value(form,"system")) throw new Error("Enter a classification system.");
      if (value(form,"classificationValue")) simple(facet,"value",value(form,"classificationValue"));
      simple(facet,"system",value(form,"system"));
    } else if (kind==="attribute") {
      if (!value(form,"attributeName")) throw new Error("Enter an IFC attribute.");
      simple(facet,"name",value(form,"attributeName"));
      addValue(facet,"value",value(form,"valueMode"),value(form,"valueText"));
    } else if (kind==="property") {
      if (!value(form,"propertySet")||!value(form,"baseName")) throw new Error("Enter a property set and property name.");
      simple(facet,"propertySet",value(form,"propertySet")); simple(facet,"baseName",value(form,"baseName"));
      const dataType=value(form,"dataType").toUpperCase();
      if (dataType) { if (!/^[A-Z]+$/.test(dataType)) throw new Error("IFC data type must contain letters only, such as IFCLABEL."); facet.setAttribute("dataType",dataType); }
      addValue(facet,"value",value(form,"valueMode"),value(form,"valueText"));
    } else if (kind==="material") addValue(facet,"value",value(form,"valueMode"),value(form,"valueText"));
    return facet;
  }
  function saveFacet(event) {
    event.preventDefault();
    try {
      const f=buildFacet(new FormData(event.currentTarget)), reqs=child(current(),"requirements");
      const previous=editIndex===null ? null : requirements()[editIndex];
      if (previous?.localName===f.localName) reqs.replaceChild(f,previous);
      else {
        previous?.remove();
        insertFacet(reqs,f);
      }
      $("#facet-dialog").close(); markDirty(); collectOptions(); renderRequirements(); updateHeader(); toast("Requirement saved");
    } catch (error) { toast(error.message); }
  }

  function validateDoc(doc) {
    let errors=0,warnings=0; const messages=[]; const list=specsFor(doc), identifiers=new Set();
    const info=child(doc.documentElement,"info");
    const reparsed=new DOMParser().parseFromString(serializeDoc(doc),"application/xml");
    if (reparsed.querySelector("parsererror")) { errors++; messages.push("The exported XML is not well formed."); }
    if (!child(info,"title")?.textContent.trim()) { errors++; messages.push("Document title is missing."); }
    if (!list.length) { errors++; messages.push("Add at least one specification."); }
    for (const [i,s] of list.entries()) {
      const tag=s.getAttribute("identifier")||`Specification ${i+1}`;
      if (!s.getAttribute("name") || !s.getAttribute("ifcVersion")) { errors++; messages.push(`${tag}: name or IFC version is missing.`); }
      if (identifiers.has(tag)) { errors++; messages.push(`${tag}: identifier is repeated.`); } identifiers.add(tag);
      const app=child(s,"applicability"), entity=child(app,"entity");
      if (!app || !entity || !simpleText(entity,"name")) { errors++; messages.push(`${tag}: applicable IFC entity is missing.`); }
      const min=app?.getAttribute("minOccurs")||"0", max=app?.getAttribute("maxOccurs")||"unbounded";
      if (!/^\d+$/.test(min) || !(/^(unbounded|\d+)$/.test(max)) || max!=="unbounded" && Number(max)<Number(min)) { errors++; messages.push(`${tag}: occurrence limits are invalid.`); }
      const reqs=child(s,"requirements");
      if (!reqs || !children(reqs).length) { warnings++; messages.push(`${tag}: no requirements have been added.`); }
      for (const f of children(reqs)) {
        if (f.localName==="property" && (!simpleText(f,"propertySet")||!simpleText(f,"baseName"))) { errors++; messages.push(`${tag}: a property needs its set and name.`); }
        if (f.localName==="attribute" && !simpleText(f,"name")) { errors++; messages.push(`${tag}: an attribute name is missing.`); }
        if (f.localName==="classification" && !simpleText(f,"system")) { errors++; messages.push(`${tag}: a classification system is missing.`); }
      }
    }
    if (!errors && !warnings) messages.push(`${list.length} specifications and ${list.reduce((n,s)=>n+requirements(s).length,0)} requirements checked.`);
    return {errors,warnings,messages};
  }
  function runChecks() { if (!activeFile()) return null; checkState=validateDoc(xml); activeFile().checkState=checkState; renderChecks(); updateHeader(); return checkState; }

  function serializeDoc(doc) { return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(doc)}\n`; }
  function triggerDownload(blob,name) {
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement("a"); anchor.href=url; anchor.download=name;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  function download() {
    if (!activeFile()) return;
    const result=runChecks(); if (result.errors) { toast("Fix builder issues before downloading."); return; }
    triggerDownload(new Blob([serializeDoc(xml)],{type:"application/xml;charset=utf-8"}),fileName);
    dirty=false; activeFile().dirty=false; updateHeader(); renderSidebar(); toast(`${fileName} downloaded`);
  }
  function downloadAll() {
    if (!files.length) return;
    const bad=files.find(f=>validateDoc(f.doc).errors);
    if (bad) { activate(files.indexOf(bad)); runChecks(); toast(`Fix ${bad.name} before downloading all files.`); return; }
    const entries=files.map(f=>({name:f.name,content:serializeDoc(f.doc)}));
    triggerDownload(window.idsBuilderZip(entries),"IDS_workspace.zip");
    for (const f of files) f.dirty=false; dirty=false; updateHeader(); renderSidebar(); toast(`${entries.length} IDS files packaged in ZIP`);
  }

  function toast(message) { const t=$("#toast"); t.textContent=message; t.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>t.classList.remove("show"),4200); }
  $("#new-file").addEventListener("click",()=>{ emptyDoc(); toast("New IDS added to workspace"); });
  $("#jump-setup").addEventListener("click",()=>$("#setup-card").scrollIntoView({behavior:"smooth",block:"start"}));
  $("#import-file").addEventListener("click",()=>$("#file-input").click());
  $("#file-input").addEventListener("change",async e=>{ const incoming=[...e.target.files]; for (const file of incoming) try { loadXml(await file.text(),file.name); } catch(error) { toast(`${file.name}: ${error.message}`); } e.target.value=""; });
  $("#export-file").addEventListener("click",download);
  $("#preview-file").addEventListener("click",()=>{ $("#xml-preview").value=serializeDoc(xml); $("#xml-dialog").showModal(); });
  $("#close-xml").addEventListener("click",()=>$("#xml-dialog").close());
  $("#export-all").addEventListener("click",downloadAll);
  $("#add-spec").addEventListener("click",addSpec);
  $("#clear-all").addEventListener("click",removeAllFiles);
  $("#extract-selected").addEventListener("click",extractSelected);
  $("#spec-search").addEventListener("input",renderSidebar);
  $("#file-list").addEventListener("click",e=>{
    const remove=e.target.closest("[data-remove-file]");
    if (remove) { removeFile(Number(remove.dataset.removeFile)); return; }
    const spec=e.target.closest("[data-select-file]");
    if (spec) { activate(Number(spec.dataset.selectFile),Number(spec.dataset.selectSpec)); return; }
    const file=e.target.closest("[data-open-file]"); if (file) activate(Number(file.dataset.openFile));
  });
  $("#file-list").addEventListener("change",e=>{
    const key=e.target.dataset.pick; if (!key) return;
    if (e.target.checked) picked.add(key); else picked.delete(key);
    updateHeader();
  });
  $("#active-file-bar").addEventListener("input",e=>{
    if (e.target.id!=="file-name-input") return;
    const f=activeFile(), raw=e.target.value.trim().replace(/[\\/]/g,"_"); if (!f || !raw) return;
    const wanted=raw.toLowerCase().endsWith(".ids")?raw:`${raw}.ids`;
    if (files.some(other=>other!==f && other.name.toLowerCase()===wanted.toLowerCase())) return;
    f.name=wanted; fileName=wanted; f.dirty=true; dirty=true; checkState=null; f.checkState=null;
    updateHeader(); renderSidebar(); renderChecks();
  });
  $("#active-file-bar").addEventListener("change",e=>{
    const f=activeFile(); if (!f) return;
    if (e.target.id==="custom-file-color") { setFileColor(e.target.value); return; }
    if (e.target.id==="file-name-input") { renderActiveFileBar(); }
  });
  $("#active-file-bar").addEventListener("click",e=>{
    const color=e.target.closest("[data-file-color]");
    if (color) { setFileColor(color.dataset.fileColor); return; }
    if (e.target.id==="close-file") removeFile(active);
  });
  $("#setup-content").addEventListener("click",e=>{ const id=e.target.dataset.setup; if (!id) return; const item=SETUP_ITEMS.find(x=>x.id===id); if (item) addSetupCheck(item); });
  $("#info-form").addEventListener("input",e=>{ const key=e.target.dataset.info; if (key) setInfo(key,e.target.value); });
  $("#info-form").addEventListener("change",e=>{ const key=e.target.dataset.info; if (key) setInfo(key,e.target.value); });
  $("#spec-editor").addEventListener("input",e=>{ const key=e.target.dataset.spec; if (key && e.target.tagName!=="SELECT") setSpecField(key,e.target.value.trim(),true); });
  $("#spec-editor").addEventListener("change",e=>{ const key=e.target.dataset.spec; if (key) setSpecField(key,e.target.value.trim()); });
  $("#spec-editor").addEventListener("click",e=>{ if (e.target.id!=="delete-spec") return; if (!confirm(`Delete ${current()?.getAttribute("name") || "this specification"}?`)) return; const id=activeFile().id; current().remove(); for (const key of [...picked]) if (key.startsWith(`${id}:`)) picked.delete(key); selected=Math.max(0,Math.min(selected,specs().length-1)); markDirty(); render(); });
  $("#requirements-content").addEventListener("input",e=>{ if (e.target.id==="rule-search") renderRuleRows(); });
  $("#requirements-content").addEventListener("click",e=>{
    if (e.target.id==="add-rule") return openFacet();
    const edit=e.target.closest("[data-edit]"); if (edit) return openFacet(Number(edit.dataset.edit));
    const remove=e.target.closest("[data-remove]"); if (!remove) return;
    const index=Number(remove.dataset.remove), f=requirements()[index];
    if (!confirm(`Delete ${facetLabel(f)}?`)) return;
    f.remove(); markDirty(); renderRequirements(); updateHeader(); toast("Requirement deleted");
  });
  $("#facet-form").addEventListener("submit",saveFacet);
  $("#dialog-fields").addEventListener("change",e=>{ if (e.target.name==="kind") fillFacetFields(); });
  $("#close-dialog").addEventListener("click",()=>$("#facet-dialog").close());
  $("#cancel-dialog").addEventListener("click",()=>$("#facet-dialog").close());
  $("#run-checks").addEventListener("click",()=>runChecks());
  emptyDoc();
})();

