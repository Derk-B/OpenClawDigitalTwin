const stageWidth = window.innerWidth - 300;
const stageHeight = window.innerHeight;
let oldState = null;

const stage = new Konva.Stage({
  container: "stage",
  width: stageWidth,
  height: stageHeight,
});

const backgroundLayer = new Konva.Layer();
const connectionLayer = new Konva.Layer();
const nodeLayer = new Konva.Layer();

stage.add(backgroundLayer);
stage.add(connectionLayer);
stage.add(nodeLayer);

const statusBox = document.getElementById("status");
const toolboxItems = document.querySelectorAll(".tool-item");
const stageParent = document.getElementById("stage-parent");
const propertiesPanel = document.getElementById("properties-panel");
const propertiesTitle = document.getElementById("propertiesTitle");
const propertiesType = document.getElementById("propertiesType");
const propertyName = document.getElementById("propertyName");
const propertyRate = document.getElementById("propertyRate");
const propertyCost = document.getElementById("propertyCost");
const propertyNotes = document.getElementById("propertyNotes");
const savePropertiesButton = document.getElementById("saveProperties");

let connectMode = false;
let pendingSource = null;
let selectedNode = null;
let selectedLink = null;
let nextId = 1;
const connections = [];

const setStatus = (text) => {
  statusBox.textContent = text;
};

const clearSelectedNode = () => {
  if (!selectedNode) {
    return;
  }
  const rect = selectedNode.findOne("Rect");
  if (rect) {
    rect.stroke("#0f172a");
    rect.strokeWidth(2);
  }
  selectedNode = null;
  nodeLayer.batchDraw();
};

const clearSelectedLink = () => {
  if (!selectedLink) {
    return;
  }
  selectedLink.stroke("#111827");
  selectedLink.strokeWidth(3);
  selectedLink.fill("#111827");
  selectedLink = null;
  hideProperties();
  connectionLayer.batchDraw();
};

const selectLink = (link) => {
  clearSelectedNode();
  clearSelectedLink();
  selectedLink = link;
  selectedLink.stroke("#10b981");
  selectedLink.strokeWidth(5);
  selectedLink.fill("#10b981");
  connectionLayer.batchDraw();
};

const showProperties = (item, type) => {
  const data = item.linkData || item.nodeData || {};
  propertiesTitle.textContent = `${type} properties`;
  propertiesType.textContent = `${type}`;
  propertyName.value = data.name || "";
  propertyRate.value = data.rate || "";
  propertyCost.value = data.cost || "";
  propertyNotes.value = data.notes || "";
  propertiesPanel.style.display = "block";
};

const hideProperties = () => {
  propertiesPanel.style.display = "none";
};

const updatePropertiesFromForm = () => {
  const newData = {
    name: propertyName.value.trim(),
    rate: propertyRate.value.trim(),
    cost: propertyCost.value.trim(),
    notes: propertyNotes.value.trim(),
  };

  if (selectedLink) {
    selectedLink.linkData = newData;
    selectedLink.linkLabel.text(newData.name || "");
    updateConnections();
    setStatus(`Link updated: ${newData.name || "Unnamed transport link"}`);
    return;
  }

  if (selectedNode) {
    selectedNode.nodeData = newData;
    const label = selectedNode.findOne("Text");
    const typeLabel =
      selectedNode.elementType === "truck" ? "Truck" : "Machine";
    if (label) {
      label.text(newData.name || typeLabel);
    }
    nodeLayer.batchDraw();
    setStatus(`Node updated: ${newData.name || typeLabel}`);
  }
};

const selectNode = (node) => {
  clearSelectedLink();
  clearSelectedNode();
  selectedNode = node;
  const rect = node.findOne("Rect");
  if (rect) {
    rect.stroke("#2dd4bf");
    rect.strokeWidth(4);
  }
  nodeLayer.batchDraw();
};

const clearSelection = () => {
  pendingSource = null;
  connectMode = false;
  stageParent.classList.remove("connecting");
  clearSelectedNode();
  clearSelectedLink();
  hideProperties();
};

const deleteSelectedNode = () => {
  if (!selectedNode) {
    return;
  }

  const nodeToRemove = selectedNode;
  const remainingConnections = [];

  connections.forEach((arrow) => {
    if (
      arrow.sourceNode === nodeToRemove ||
      arrow.targetNode === nodeToRemove
    ) {
      if (arrow.linkLabel) {
        arrow.linkLabel.destroy();
      }
      arrow.destroy();
    } else {
      remainingConnections.push(arrow);
    }
  });

  connections.length = 0;
  remainingConnections.forEach((arrow) => connections.push(arrow));

  nodeToRemove.destroy();
  clearSelectedNode();
  connectionLayer.batchDraw();
  nodeLayer.batchDraw();
  setStatus(`${nodeToRemove.elementType} deleted from the canvas.`);
};

const deleteSelectedLink = () => {
  if (!selectedLink) {
    return;
  }
  if (selectedLink.linkLabel) {
    selectedLink.linkLabel.destroy();
  }
  const index = connections.indexOf(selectedLink);
  if (index > -1) {
    connections.splice(index, 1);
  }
  selectedLink.destroy();
  selectedLink = null;
  hideProperties();
  connectionLayer.batchDraw();
  setStatus("Transport link deleted from the canvas.");
};

const updateCanvasSize = () => {
  const parentRect = stageParent.getBoundingClientRect();
  stage.width(parentRect.width);
  stage.height(parentRect.height);
  stage.draw();
};

window.addEventListener("resize", updateCanvasSize);
updateCanvasSize();

const getStagePointerPosition = (event) => {
  const pointer = stage.getPointerPosition();
  if (pointer) {
    return pointer;
  }
  const rect = stage.container().getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
};

const truckImage = new window.Image();
truckImage.src = "truck.png";
truckImage.addEventListener("load", () => {
  nodeLayer.batchDraw();
});
truckImage.onerror = () => {
  console.warn("Could not load truck.png");
};

const machineImage = new window.Image();
machineImage.src = "industrial_machine.png";
machineImage.addEventListener("load", () => {
  nodeLayer.batchDraw();
});
machineImage.onerror = () => {
  console.warn("Could not load industrial_machine.png");
};

const createNode = (type, x, y, id, nodeData = {}) => {
  const width = 140;
  const imageHeight = 70;
  const labelHeight = 24;
  const gap = 6;
  const color = type === "truck" ? "#f97316" : "#2563eb";
  const label = type === "truck" ? "Truck" : "Machine";

  const group = new Konva.Group({
    x,
    y,
    draggable: true,
    name: "factory-node",
  });

  let rect;

  if (type === "truck" || type === "machine") {
    rect = new Konva.Rect({
      width,
      height: imageHeight,
      fill: color,
      stroke: "#0f172a",
      strokeWidth: 2,
      cornerRadius: 10,
    });

    const imageNode = new Konva.Image({
      image:
        type === "truck"
          ? truckImage.complete
            ? truckImage
            : null
          : machineImage.complete
            ? machineImage
            : null,
      width,
      height: imageHeight,
    });

    group.add(rect);
    group.add(imageNode);

    const currentImage = type === "truck" ? truckImage : machineImage;
    if (!currentImage.complete) {
      currentImage.addEventListener("load", () => {
        imageNode.image(currentImage);
        rect.visible(false);
        nodeLayer.batchDraw();
      });
    } else {
      rect.visible(false);
    }
  } else {
    rect = new Konva.Rect({
      width,
      height: imageHeight,
      fill: color,
      stroke: "#0f172a",
      strokeWidth: 2,
      cornerRadius: 10,
    });
    group.add(rect);
  }

  const text = new Konva.Text({
    text: label,
    fontSize: 16,
    fontFamily: "Arial",
    fill: "black",
    width,
    height: labelHeight,
    y: imageHeight + gap,
    align: "center",
    verticalAlign: "middle",
  });

  group.add(text);
  group.elementType = type;
  group.nodeData = {
    name: nodeData.name || "",
    rate: nodeData.rate || "",
    cost: nodeData.cost || "",
    notes: nodeData.notes || "",
  };
  text.text(group.nodeData.name || label);

  if (id) {
    group.id(id);
    const parsed = /^node-(\d+)$/.exec(id);
    if (parsed) {
      nextId = Math.max(nextId, Number(parsed[1]) + 1);
    }
  } else {
    group.id(`node-${nextId++}`);
  }
  group.on("click", () => handleNodeClick(group));
  group.on("dragmove", updateConnections);
  group.on("mouseover", () => (document.body.style.cursor = "grab"));
  group.on("mouseout", () => (document.body.style.cursor = "default"));

  nodeLayer.add(group);
  nodeLayer.draw();
  return group;
};

const computeCenter = (node) => {
  const rect = node.getClientRect({ relativeTo: stage });
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
};

const handleLinkClick = (link) => {
  selectLink(link);
  showProperties(link, "Transport link");
  const name = link.linkData?.name || "Unnamed transport link";
  setStatus(`Selected link: ${name}. Edit properties and save.`);
};

const createArrow = (source, target, linkData = {}) => {
  const sourceCenter = computeCenter(source);
  const targetCenter = computeCenter(target);

  const arrow = new Konva.Arrow({
    points: [sourceCenter.x, sourceCenter.y, targetCenter.x, targetCenter.y],
    pointerLength: 12,
    pointerWidth: 12,
    fill: "#111827",
    stroke: "#111827",
    strokeWidth: 3,
  });
  arrow.sourceNode = source;
  arrow.targetNode = target;
  arrow.linkData = {
    name: linkData.name || "",
    rate: linkData.rate || "",
    cost: linkData.cost || "",
    notes: linkData.notes || "",
  };

  const label = new Konva.Label({
    opacity: 0.9,
  });

  label.add(
    new Konva.Tag({
      fill: "white",
      stroke: "#d1d5db",
      strokeWidth: 1,
      cornerRadius: 4,
    }),
  );

  const labelText = new Konva.Text({
    text: arrow.linkData.name || "",
    fontSize: 14,
    fontFamily: "Arial",
    fill: "#111827",
    padding: 4,
    align: "center",
  });

  label.add(labelText);
  arrow.linkLabel = label;
  const updateLabelPosition = () => {
    const midX = (sourceCenter.x + targetCenter.x) / 2;
    const midY = (sourceCenter.y + targetCenter.y) / 2;
    label.position({ x: midX, y: midY });
    label.offsetX(label.width() / 2);
    label.offsetY(label.height() / 2);
  };
  updateLabelPosition();

  const selectThisLink = () => handleLinkClick(arrow);
  arrow.on("click", selectThisLink);
  label.on("click", selectThisLink);
  arrow.on("mouseover", () => (document.body.style.cursor = "pointer"));
  label.on("mouseover", () => (document.body.style.cursor = "pointer"));
  arrow.on("mouseout", () => (document.body.style.cursor = "default"));
  label.on("mouseout", () => (document.body.style.cursor = "default"));

  connectionLayer.add(arrow);
  connectionLayer.add(label);
  connectionLayer.draw();

  connections.push(arrow);
  return arrow;
};

const updateConnections = () => {
  connections.forEach((arrow) => {
    const sourceCenter = computeCenter(arrow.sourceNode);
    const targetCenter = computeCenter(arrow.targetNode);
    arrow.points([
      sourceCenter.x,
      sourceCenter.y,
      targetCenter.x,
      targetCenter.y,
    ]);

    if (arrow.linkLabel) {
      const midX = (sourceCenter.x + targetCenter.x) / 2;
      const midY = (sourceCenter.y + targetCenter.y) / 2;
      arrow.linkLabel.position({ x: midX, y: midY });
      arrow.linkLabel.offsetX(arrow.linkLabel.width() / 2);
      arrow.linkLabel.offsetY(arrow.linkLabel.height() / 2);
      const labelText = arrow.linkLabel.findOne("Text");
      if (labelText) {
        labelText.text(arrow.linkData?.name || "");
      }
    }
  });
  connectionLayer.batchDraw();
};

const getAppState = () => {
  const nodes = nodeLayer.find("Group").map((group) => ({
    id: group.id(),
    type: group.elementType,
    x: group.x(),
    y: group.y(),
    data: group.nodeData || {},
  }));

  const connectionsState = connections.map((arrow) => ({
    sourceId: arrow.sourceNode.id(),
    targetId: arrow.targetNode.id(),
    linkData: arrow.linkData || {},
  }));

  return {
    nodes,
    connections: connectionsState,
  };
};

const clearCanvas = () => {
  clearSelectedNode();
  clearSelectedLink();
  hideProperties();
  connections.forEach((arrow) => {
    if (arrow.linkLabel) {
      arrow.linkLabel.destroy();
    }
    arrow.destroy();
  });
  connections.length = 0;
  nodeLayer.destroyChildren();
  connectionLayer.destroyChildren();
  connectionLayer.batchDraw();
  nodeLayer.batchDraw();
};

const loadState = (state) => {
  if (!state || !Array.isArray(state.nodes)) {
    setStatus("Invalid config file.");
    return;
  }

  clearCanvas();

  const nodeMap = new Map();

  state.nodes.forEach((nodeData) => {
    const group = createNode(
      nodeData.type,
      nodeData.x,
      nodeData.y,
      nodeData.id,
      nodeData.data || {},
    );
    nodeMap.set(nodeData.id, group);
  });

  if (Array.isArray(state.connections)) {
    state.connections.forEach((connectionData) => {
      const source = nodeMap.get(connectionData.sourceId);
      const target = nodeMap.get(connectionData.targetId);
      if (source && target) {
        createArrow(source, target, connectionData.linkData || {});
      }
    });
  }

  setStatus("Config loaded.");
};

const downloadConfig = () => {
  const state = getAppState();
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "factory-config.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  setStatus("Config saved to factory-config.json.");
};

const loadConfigFromUrl = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      setStatus(
        `Failed to load config: ${response.status} ${response.statusText}`,
      );
      return;
    }
    const state = await response.json();

    const newState = JSON.stringify(state);
    if (newState === oldState) {
      return;
    }
    oldState = newState;
    loadState(state);
    setStatus(`Loaded config from ${url}`);
  } catch (error) {
    console.warn("Unable to fetch config from server", error);
    setStatus("Unable to load config from server.");
  }
};

const handleNodeClick = (node) => {
  if (!connectMode) {
    selectNode(node);
    showProperties(node, node.elementType === "truck" ? "Truck" : "Machine");
    setStatus(
      `Selected ${node.elementType}. Drag it to reposition, press Delete to remove it, or choose Transport Link to connect nodes.`,
    );
    return;
  }

  if (!pendingSource) {
    pendingSource = node;
    setStatus(
      `Source selected: ${node.elementType}. Now click the target node to create a transport link.`,
    );
    return;
  }

  if (pendingSource === node) {
    setStatus(
      "Cannot connect a node to itself. Choose a different target node.",
    );
    return;
  }

  createArrow(pendingSource, node);
  setStatus(
    `Transport link created between ${pendingSource.elementType} and ${node.elementType}.`,
  );
  connectMode = false;
  pendingSource = null;
};

const enableTransportLinkMode = () => {
  connectMode = true;
  pendingSource = null;
  setStatus(
    "Transport Link mode active. Click a Truck or Machine node to choose the source first.",
  );
};

const getDropCoords = (event) => {
  const rect = stage.container().getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
};

let draggedToolType = null;

const saveButton = document.getElementById("saveConfig");
const loadConfigInput = document.getElementById("loadConfigInput");

const stageContainer = stage.container();

toolboxItems.forEach((item) => {
  item.addEventListener("dragstart", (event) => {
    draggedToolType = event.currentTarget.dataset.tool;
    event.dataTransfer.setData("text/plain", draggedToolType);
    event.dataTransfer.effectAllowed = "copy";
  });
});

saveButton.addEventListener("click", downloadConfig);
loadConfigInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) {
    handleLoadFile(file);
  }
  loadConfigInput.value = "";
});

savePropertiesButton.addEventListener("click", updatePropertiesFromForm);

const handleDragOver = (event) => {
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
};

const handleDrop = (event) => {
  event.preventDefault();
  const toolType = event.dataTransfer.getData("text/plain") || draggedToolType;
  if (!toolType) {
    return;
  }

  const coords = getDropCoords(event);

  if (toolType === "transport_link") {
    enableTransportLinkMode();
    return;
  }

  createNode(toolType, coords.x - 70, coords.y - 35);
  setStatus(
    `${toolType === "truck" ? "Truck" : "Machine"} added to the canvas.`,
  );
};

stageParent.addEventListener("dragover", handleDragOver);
stageParent.addEventListener("drop", handleDrop);

stage.on("click", (event) => {
  if (event.target === stage && connectMode && pendingSource) {
    setStatus(
      "Click a valid Truck or Machine node to finish the transport link.",
    );
  }
});

window.addEventListener("keydown", (event) => {
  const active = document.activeElement;
  const isTextInput =
    active &&
    (active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.isContentEditable);

  if (isTextInput) {
    return;
  }

  if (event.key === "Delete" || event.key === "Backspace") {
    if (selectedLink) {
      deleteSelectedLink();
    } else {
      deleteSelectedNode();
    }
  }
  if (event.key === "Escape") {
    clearSelectedNode();
    clearSelection();
    setStatus("Selection cleared.");
  }
});

loadConfigFromUrl("http://localhost:8080/factory-config.json");
setInterval(() => {
  loadConfigFromUrl("http://localhost:8080/factory-config.json");
}, 500);

setStatus(
  "Drag a node onto the canvas to start building your factory schematic. Select a node and press Delete to remove it.",
);
