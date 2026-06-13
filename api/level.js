// /api/level.js

function checkMapContains(m, targetValues) {
    if (!Array.isArray(targetValues)) targetValues = [targetValues];
    for (let r = 0; r < m.length; r++) {
        for (let c = 0; c < m[r].length; c++) {
            if (targetValues.includes(m[r][c])) return true;
        }
    }
    return false;
}

function generateSolvableMap(rows, cols, coverage, features) {
    let hasPortal = features.includes('portal'), hasBridge = features.includes('bridge');
    let hasIce = features.includes('ice'), hasBomb = features.includes('bomb');
    let hasKey = features.includes('key'), hasArrow = features.includes('arrow');
    let hasFog = features.includes('fog');

    let globalAttempts = 0;
    let finalMap = [];
    let currentPortals = {}, currentBombs = {};

    while (globalAttempts < 300) {
        globalAttempts++;
        let bestPath = []; let attempts = 0; let maxAttempts = rows > 12 ? 300 : 150;

        while (bestPath.length < Math.floor(rows * cols * coverage) && attempts < maxAttempts) {
            let currentPath = []; let tempVisited = Array.from({ length: rows }, () => Array(cols).fill(false));
            let jumped = false;
            let bridgeCountLocal = 0; 
            let r = Math.floor(Math.random() * rows), c = Math.floor(Math.random() * cols);
            currentPath.push({ r, c }); tempVisited[r][c] = true;

            while (true) {
                let moved = false;
                if (hasPortal && !jumped && currentPath.length > 3 && Math.random() < 0.1) {
                    let unv = [];
                    for (let ir = 0; ir < rows; ir++) {
                        for (let ic = 0; ic < cols; ic++) {
                            if (!tempVisited[ir][ic] && Math.abs(ir - r) + Math.abs(ic - c) > 1) unv.push({ r: ir, c: ic });
                        }
                    }
                    if (unv.length > 0) {
                        let t = unv[Math.floor(Math.random() * unv.length)];
                        r = t.r; c = t.c; currentPath.push({ r, c }); tempVisited[r][c] = true; jumped = true; moved = true;
                    }
                }
                
                if (!moved && hasBridge && currentPath.length >= 4 && bridgeCountLocal < 5) {
                    let dirs = [{ dr: -2, dc: 0 }, { dr: 2, dc: 0 }, { dr: 0, dc: -2 }, { dr: 0, dc: 2 }];
                    for (let dir of dirs) {
                        let nnr = r + dir.dr, nnc = c + dir.dc; let mr = r + dir.dr / 2, mc = c + dir.dc / 2;
                        if (nnr >= 0 && nnr < rows && nnc >= 0 && nnc < cols && !tempVisited[nnr][nnc] && tempVisited[mr][mc]) {
                            let idx = currentPath.findIndex(p => p.r === mr && p.c === mc);
                            if (idx > 0 && idx < currentPath.length - 1) {
                                let prevNode = currentPath[idx - 1];
                                let nextNode = currentPath[idx + 1];
                                let firstPassIsVertical = (prevNode.c === nextNode.c);
                                let firstPassIsHorizontal = (prevNode.r === nextNode.r);
                                let canCross = false;
                                if (firstPassIsVertical && dir.dr === 0) canCross = true;
                                if (firstPassIsHorizontal && dir.dc === 0) canCross = true;
                                if (canCross) {
                                    currentPath.push({ r: nnr, c: nnc, bridgeR: mr, bridgeC: mc, firstStepIdx: idx });
                                    r = nnr; c = nnc; tempVisited[nnr][nnc] = true;
                                    bridgeCountLocal++;
                                    moved = true; break;
                                }
                            }
                        }
                    }
                }
                
                if (!moved) {
                    let neighbors = [];
                    const dirs = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
                    for (let dir of dirs) {
                        let nr = r + dir.dr; let nc = c + dir.dc;
                        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !tempVisited[nr][nc]) neighbors.push({ r: nr, c: nc });
                    }
                    if (neighbors.length === 0) break;
                    let next = neighbors[Math.floor(Math.random() * neighbors.length)];
                    r = next.r; c = next.c; currentPath.push({ r, c }); tempVisited[r][c] = true;
                }
            }
            if (currentPath.length > bestPath.length) bestPath = currentPath;
            attempts++;
        }

        finalMap = Array.from({ length: rows }, () => Array(cols).fill(0));
        currentPortals = {}; currentBombs = {};

        for (let i = 0; i < bestPath.length; i++) { let p = bestPath[i]; finalMap[p.r][p.c] = 1; }
        finalMap[bestPath[0].r][bestPath[0].c] = 2;

        for (let i = 0; i < bestPath.length; i++) {
            let p = bestPath[i];
            if (i > 0 && !p.bridgeR) {
                let prev = bestPath[i - 1];
                if (Math.abs(p.r - prev.r) + Math.abs(p.c - prev.c) > 1 && finalMap[prev.r][prev.c] === 1 && finalMap[p.r][p.c] === 1) {
                    finalMap[prev.r][prev.c] = 3; finalMap[p.r][p.c] = 3;
                    currentPortals[`${prev.r},${prev.c}`] = { r: p.r, c: p.c }; currentPortals[`${p.r},${p.c}`] = { r: prev.r, c: prev.c };
                }
            }
            if (p.bridgeR !== undefined && finalMap[p.bridgeR][p.bridgeC] === 1) finalMap[p.bridgeR][p.bridgeC] = 7;
        }

        if (hasIce) {
            for (let i = 2; i < bestPath.length - 2; i++) {
                let a = bestPath[i - 1], b = bestPath[i], c = bestPath[i + 1];
                if (finalMap[b.r][b.c] === 1 && (a.r - b.r === b.r - c.r) && (a.c - b.c === b.c - c.c)) {
                    if (Math.random() < 0.35) finalMap[b.r][b.c] = 6;
                }
            }
        }

        // 防禦性修正：確保炸彈與隱藏牆只會覆蓋一般路徑 (1)
        if (hasBomb) {
            let validIndices = Array.from(bestPath.keys()).slice(2, -2).sort(() => Math.random() - 0.5);
            for (let i = 0; i < validIndices.length; i++) {
                let idx = validIndices[i]; let bPos = bestPath[idx];
                if (finalMap[bPos.r][bPos.c] === 1) {
                    let hidden = []; let hideCount = Math.floor(Math.random() * 2) + 2; let canPlace = true;
                    for (let j = 1; j <= hideCount; j++) {
                        if (idx + j >= bestPath.length) { canPlace = false; break; }
                        let nPos = bestPath[idx + j];
                        // 嚴格檢查：必須是基本路徑方塊 (1) 才能設為炸彈引爆範圍，避免衝擊傳送門或十字橋邏輯
                        if (finalMap[nPos.r][nPos.c] !== 1) { canPlace = false; break; }
                        hidden.push({ r: nPos.r, c: nPos.c });
                    }
                    if (canPlace && hidden.length > 0) {
                        finalMap[bPos.r][bPos.c] = 4;
                        hidden.forEach(p => finalMap[p.r][p.c] = 5);
                        currentBombs[`${bPos.r},${bPos.c}`] = hidden; break;
                    }
                }
            }
        }

        if (hasKey) {
            let idxs = [];
            for (let i = 2; i < bestPath.length - 2; i++) {
                if (finalMap[bestPath[i].r][bestPath[i].c] === 1) idxs.push(i);
            }
            if (idxs.length >= 2) {
                idxs.sort((a, b) => a - b);
                
                let kIdx = -1, lIdx = -1;
                let safetyFallback = 0;
                
                while (safetyFallback < 50) {
                    safetyFallback++;
                    let tempK = idxs[Math.floor(Math.random() * (idxs.length / 2))];
                    let tempL = idxs[Math.floor(idxs.length / 2) + Math.floor(Math.random() * (idxs.length / 2))];
                    
                    if (tempK >= tempL) continue;
                    
                    let structureConflict = false;
                    for (let i = 0; i < bestPath.length; i++) {
                        let node = bestPath[i];
                        if (node.bridgeR !== undefined && node.firstStepIdx !== undefined) {
                            let firstPass = node.firstStepIdx;
                            let secondPass = i;
                            if (tempK > firstPass && tempK < secondPass) {
                                structureConflict = true;
                                break;
                            }
                        }
                    }
                    
                    if (!structureConflict) {
                        kIdx = tempK;
                        lIdx = tempL;
                        break;
                    }
                }
                
                if (kIdx !== -1 && lIdx !== -1) {
                    finalMap[bestPath[kIdx].r][bestPath[kIdx].c] = 8;
                    finalMap[bestPath[lIdx].r][bestPath[lIdx].c] = 9;
                } else {
                    continue;
                }
            }
        }

        if (hasArrow) {
            let idxs = [];
            for (let i = 2; i < bestPath.length - 2; i++) {
                if (finalMap[bestPath[i].r][bestPath[i].c] === 1) idxs.push(i);
            }
            if (idxs.length > 0) {
                let idx = idxs[Math.floor(Math.random() * idxs.length)];
                let curr = bestPath[idx], prev = bestPath[idx - 1];
                if (curr.r < prev.r) finalMap[curr.r][curr.c] = 10;
                else if (curr.r > prev.r) finalMap[curr.r][curr.c] = 11;
                else if (curr.c < prev.c) finalMap[curr.r][curr.c] = 12;
                else if (curr.c > prev.c) finalMap[curr.r][curr.c] = 13;
            }
        }

        if (hasFog) {
            let idxs = [];
            for (let i = 2; i < bestPath.length - 2; i++) {
                if (finalMap[bestPath[i].r][bestPath[i].c] === 1) idxs.push(i);
            }
            if (idxs.length > 0) {
                let idx = idxs[Math.floor(Math.random() * idxs.length)];
                finalMap[bestPath[idx].r][bestPath[idx].c] = 14;
            }
        }

        let isMapValid = true;
        if (hasPortal && !checkMapContains(finalMap, 3)) isMapValid = false;
        if (hasBomb && !checkMapContains(finalMap, 4)) isMapValid = false;
        if (hasIce && !checkMapContains(finalMap, 6)) isMapValid = false;
        if (hasBridge && !checkMapContains(finalMap, 7)) isMapValid = false;
        if (hasKey && !checkMapContains(finalMap, 8)) isMapValid = false;
        if (hasArrow && !checkMapContains(finalMap, [10, 11, 12, 13])) isMapValid = false;
        if (hasFog && !checkMapContains(finalMap, 14)) isMapValid = false;

        if (isMapValid || globalAttempts >= 300) {
            return { map: finalMap, portals: currentPortals, bombs: currentBombs };
        }
    }
    return { map: finalMap, portals: {}, bombs: {} };
}

export default function handler(req, res) {
    const level = parseInt(req.query.level) || 1;
    
    let unlocks = [];
    if (level >= 9) unlocks.push('portal');
    if (level >= 17) unlocks.push('bomb');
    if (level >= 32) unlocks.push('ice');
    if (level >= 52) unlocks.push('bridge');
    if (level >= 84) unlocks.push('key');
    if (level >= 120) unlocks.push('arrow');
    if (level >= 180) unlocks.push('fog');

    let isTutorial = false; let forceFeat = null;
    if (level >= 9 && level <= 11) { isTutorial = true; forceFeat = 'portal'; }
    if (level >= 17 && level <= 19) { isTutorial = true; forceFeat = 'bomb'; }
    if (level >= 32 && level <= 34) { isTutorial = true; forceFeat = 'ice'; }
    if (level >= 52 && level <= 54) { isTutorial = true; forceFeat = 'bridge'; }
    if (level >= 84 && level <= 86) { isTutorial = true; forceFeat = 'key'; }
    if (level >= 120 && level <= 122) { isTutorial = true; forceFeat = 'arrow'; }
    if (level >= 180 && level <= 182) { isTutorial = true; forceFeat = 'fog'; }

    let baseSize = 4 + Math.floor((level - 1) / 8);
    if (isTutorial) baseSize = Math.max(4, baseSize - 2);
    let rows = Math.min(12, Math.max(4, baseSize));

    let activeFeats = [];
    if (isTutorial && forceFeat) activeFeats = [forceFeat];
    else {
        let maxCombo = level > 200 ? 6 : (level > 100 ? 4 : 3);
        let shuffled = unlocks.sort(() => Math.random() - 0.5);
        activeFeats = shuffled.slice(0, Math.min(maxCombo, shuffled.length));
    }

    let coverage = 0.45 + ((level % 8) * 0.05); 
    if (isTutorial) coverage = 0.35;

    const mapData = generateSolvableMap(rows, rows, coverage, activeFeats);
    
    res.status(200).json({
        rows: rows,
        cols: rows,
        map: mapData.map,
        portals: mapData.portals,
        bombs: mapData.bombs,
        isFogLevel: activeFeats.includes('fog'),
        info: activeFeats
    });
}
