class PriorityQueue {
    constructor() {
        this.items = [];
    }

    enqueue(node) {
        this.items.push(node);
    }

    dequeue() {
        let lowestIndex = 0;
        for (let i = 1; i < this.items.length; i++) {
            if (this.items[i].f < this.items[lowestIndex].f) {
                lowestIndex = i;
            }
        }
        return this.items.splice(lowestIndex, 1)[0];
    }

    isEmpty() {
        return this.items.length === 0;
    }

    includes(node) {
        return this.items.includes(node);
    }
}

class Node {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.g = 0;
        this.h = 0;
        this.f = 0;
        this.parent = null;
        this.walkable = true;
        this.danger = 0;
    }
}

class PacmanAI {
    constructor(maze, standardSize) {
        this.maze = maze;
        this.standardSize = standardSize;
        this.grid = this.createGrid();
        this.lastDirection = null;
    }

    clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    createGrid() {
        const grid = [];
        for (let i = 0; i < this.maze.rows; i++) {
            grid[i] = [];
            for (let j = 0; j < this.maze.cols; j++) {
                const node = new Node(j, i);
                node.walkable = !['*', '+'].includes(this.maze.maze[i][j]);
                grid[i][j] = node;
            }
        }
        return grid;
    }

    resetNodeData() {
        for (let row of this.grid) {
            for (let node of row) {
                node.g = 0;
                node.h = 0;
                node.f = 0;
                node.parent = null;
            }
        }
    }

    clearDangerZones() {
        for (let row of this.grid) {
            for (let node of row) {
                node.danger = 0;
            }
        }
    }

    heuristic(a, b) {
        const dangerCost = this.grid[b.y]?.[b.x]?.danger || 0;
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) + dangerCost * 2;
    }

    findPath(start, end, activeEnemies) {
        this.clearDangerZones();
        this.updateDangerZones(activeEnemies);
        this.resetNodeData();

        const startCol = this.clamp(Math.floor(start.x / this.standardSize), 0, this.maze.cols - 1);
        const startRow = this.clamp(Math.floor(start.y / this.standardSize), 0, this.maze.rows - 1);
        const endCol = this.clamp(Math.floor(end.x / this.standardSize), 0, this.maze.cols - 1);
        const endRow = this.clamp(Math.floor(end.y / this.standardSize), 0, this.maze.rows - 1);

        const startNode = this.grid[startRow][startCol];
        let endNode = this.grid[endRow][endCol];

        if (endNode.danger > 30) {
            endNode = this.findSaferAlternative(endNode);
        }

        const openSet = new PriorityQueue();
        const closedSet = new Set();
        openSet.enqueue(startNode);

        while (!openSet.isEmpty()) {
            let current = openSet.dequeue();

            if (current === endNode) {
                this.lastDirection = this.getDirection(startNode, current);
                return this.reconstructPath(current);
            }

            closedSet.add(current);

            for (let neighbor of this.getNeighbors(current)) {
                if (closedSet.has(neighbor) || !neighbor.walkable) continue;

                let backtrackPenalty = (current.parent && neighbor.x === current.parent.x && neighbor.y === current.parent.y) ? 3 : 0;
                let turnPenalty = this.lastDirection && this.getDirection(current, neighbor) !== this.lastDirection ? 1 : 0;
                let tentativeG = current.g + 1 + (neighbor.danger || 0) + backtrackPenalty + turnPenalty;

                if (!openSet.includes(neighbor) || tentativeG < neighbor.g) {
                    neighbor.parent = current;
                    neighbor.g = tentativeG;
                    neighbor.h = this.heuristic(neighbor, endNode);
                    neighbor.f = neighbor.g + neighbor.h;

                    if (!openSet.includes(neighbor)) {
                        openSet.enqueue(neighbor);
                    }
                }
            }
        }
        return null;
    }

    getDirection(from, to) {
        if (!from || !to) return null;
        if (to.x > from.x) return "right";
        if (to.x < from.x) return "left";
        if (to.y > from.y) return "down";
        if (to.y < from.y) return "up";
        return null;
    }

    updateDangerZones(activeEnemies) {
        activeEnemies.forEach(enemy => {
            if (!enemy.isWeak) {
                const ghostX = Math.floor(enemy.x / this.standardSize);
                const ghostY = Math.floor(enemy.y / this.standardSize);

                const predictedX = ghostX + Math.sign(enemy.vx || 0);
                const predictedY = ghostY + Math.sign(enemy.vy || 0);

                for (let i = -3; i <= 3; i++) {
                    for (let j = -3; j <= 3; j++) {
                        const dist = Math.sqrt(i * i + j * j);
                        const applyDanger = (gx, gy) => {
                            const x = gx + j, y = gy + i;
                            if (this.grid[y]?.[x]) {
                                const dangerCost = Math.max(0, 50 - dist * 10);
                                this.grid[y][x].danger = Math.max(this.grid[y][x].danger || 0, dangerCost);
                            }
                        };
                        applyDanger(ghostX, ghostY);
                        applyDanger(predictedX, predictedY);
                    }
                }
            }
        });
    }

    findSaferAlternative(dangerousNode) {
        const neighbors = this.getNeighbors(dangerousNode);
        let safeNodes = neighbors.filter(n => n.walkable && n.danger < 20);
        safeNodes.sort((a, b) => a.danger - b.danger);
        return safeNodes.length ? safeNodes[0] : dangerousNode;
    }

    getNeighbors(node) {
        const dirs = [
            [0, -1], [0, 1], [-1, 0], [1, 0],
        ];
        const neighbors = [];

        for (let [dx, dy] of dirs) {
            const x = node.x + dx;
            const y = node.y + dy;
            if (this.grid[y]?.[x]) {
                neighbors.push(this.grid[y][x]);
            }
        }
        return neighbors;
    }

    reconstructPath(node) {
        const path = [];
        let current = node;
        while (current !== null) {
            path.unshift({ x: current.x * this.standardSize, y: current.y * this.standardSize });
            current = current.parent;
        }
        return path;
    }

    findNearestTarget(pacmanPos, foods, powers) {
        const allTargets = [...foods, ...powers];
        let minDist = Infinity;
        let bestTarget = null;

        allTargets.forEach(target => {
            const dist = Math.hypot(target.x - pacmanPos.x, target.y - pacmanPos.y);
            if (dist < minDist) {
                minDist = dist;
                bestTarget = target;
            }
        });

        return bestTarget;
    }

    findClosestSafeTarget(pacmanPos, targets) {
        let minScore = Infinity;
        let best = null;

        targets.forEach(t => {
            const targetGrid = this.grid[Math.floor(t.y / this.standardSize)][Math.floor(t.x / this.standardSize)];
            if (targetGrid.walkable && targetGrid.danger < 20) {
                const dist = Math.abs(pacmanPos.x - t.x) + Math.abs(pacmanPos.y - t.y);
                const score = dist + targetGrid.danger * 5;
                if (score < minScore) {
                    minScore = score;
                    best = t;
                }
            }
        });

        return best;
    }

    findEscapePath(pacmanPos, threat) {
        const x = Math.floor(pacmanPos.x / this.standardSize);
        const y = Math.floor(pacmanPos.y / this.standardSize);
        const pacNode = this.grid[y][x];
        const neighbors = this.getNeighbors(pacNode);

        neighbors.sort((a, b) => {
            const da = Math.hypot(a.x - threat.x, a.y - threat.y) + a.danger;
            const db = Math.hypot(b.x - threat.x, b.y - threat.y) + b.danger;
            return db - da;
        });

        const bestEscape = neighbors.find(n => n.walkable);
        return bestEscape ? this.reconstructPath(bestEscape) : null;
    }

    calculatePathSafety(path) {
        let totalDanger = 0;
        path.forEach(pos => {
            const x = Math.floor(pos.x / this.standardSize);
            const y = Math.floor(pos.y / this.standardSize);
            totalDanger += this.grid[y]?.[x]?.danger || 0;
        });
        return totalDanger;
    }
}
