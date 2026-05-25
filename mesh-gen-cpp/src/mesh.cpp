#include "mesh.hpp"
#include <cassert>
#include <cstring>
#include <iostream>
#include <stdexcept>
#include <numeric>

namespace qt {

const int Mesh3D::hex2TetPrism[6][4] = {
    {0,3,7,1}, {3,7,1,2}, {7,1,2,6},
    {0,7,4,1}, {7,4,1,6}, {4,1,6,5}
};
const int Mesh3D::vmapX[8] = {1,0,3,2,5,4,7,6};
const int Mesh3D::vmapY[8] = {3,2,1,0,7,6,5,4};
const int Mesh3D::vmapZ[8] = {4,5,6,7,0,1,2,3};
const int Mesh3D::tetFaces[4][3] = {
    {1,2,3}, {0,3,2}, {0,1,3}, {0,2,1}
};


Mesh3D::Mesh3D(const std::vector<double>& xGrid,
               const NanosheetFET3D& geoRef,
               int nySi, int nzSi,
               int nyOx, int nzOx,
               double tOx,
               double zStretch,
               double tDummy,
               double rCorner)
    : tOx(tOx), wZ(0.0), zStretch(zStretch), tDummy(tDummy),
      rCorner(rCorner),
      nDummySd(0), nDummyOxLay(0), asymZ(false),
      xGrid(xGrid), geo(&geoRef)
{
    nDummySd    = (tDummy > 0.0) ? 1 : 0;
    nDummyOxLay = 0;

    if (nDummySd > 0) {
        this->xGrid.insert(this->xGrid.begin(), this->xGrid.front() - tDummy);
        this->xGrid.push_back(this->xGrid.back() + tDummy);
    }
    Nx = (int)this->xGrid.size();

    if (nySi % 2 == 0) { nySi += 1; std::cout << "  Warning: nySi rounded up to " << nySi << "\n"; }
    if (nzSi % 2 == 0) { nzSi += 1; std::cout << "  Warning: nzSi rounded up to " << nzSi << "\n"; }

    this->nySi = nySi; this->nzSi = nzSi;
    this->nyOx = nyOx; this->nzOx = nzOx;
    wZ = geoRef.wZ;

    asymZ = geoRef.isAsymmetric();

    // +2*nDummyOxLay adds one outer node layer per y/z side for dummyOx.
    Ny = this->nySi + 2 * (this->nyOx - 1) + 2 * nDummyOxLay;
    Nz = this->nzSi + 2 * (this->nzOx - 1) + 2 * nDummyOxLay;
    nNodes = Nx * Ny * Nz;

    int nHex = (Nx-1) * (Ny-1) * (Nz-1);
    std::cout << "  Mesh3D: " << Nx << "x" << Ny << "x" << Nz
              << " nodes  -> " << nHex << " hexes\n";

    generateNodes(geoRef);
    generateTets();
    assignMaterials();
    extractFaces();
    computeGeometry();
    buildSiIndex();

    std::cout << "  Interior faces: " << intFaces.size()
              << "   Boundary faces: " << bndFaces.size() << "\n";
}

std::vector<double> Mesh3D::yNodesAt(int ix, const NanosheetFET3D& geo) const {
    double hy = geo.lambdaY(xGrid[ix]);

    std::vector<double> yBot(nyOx - 1), yTop(nyOx - 1);
    for (int i = 0; i < nyOx - 1; ++i)
        yBot[i] = (-hy - tOx) + (tOx) * i / (nyOx - 1);
    for (int i = 1; i < nyOx; ++i)
        yTop[i-1] = hy + tOx * i / (nyOx - 1);

    double alpha = zStretch;
    int nhL = (nySi + 1) / 2;
    int nhR = nySi - nhL + 1;

    auto stretch = [alpha](int N) -> std::vector<double> {
        std::vector<double> s(N);
        for (int i = 0; i < N; ++i) {
            double t = (double)i / (N - 1);
            s[i] = (alpha > 0.0) ? std::tanh(alpha * t) / std::tanh(alpha) : t;
        }
        return s;
    };

    auto fl = stretch(nhL);
    auto fr = stretch(nhR);

    std::vector<double> ySi;
    ySi.reserve(nySi);
    for (int i = nhL - 1; i >= 0; --i) ySi.push_back(-hy * fl[i]);
    for (int i = 1; i < nhR; ++i)       ySi.push_back( hy * fr[i]);

    std::vector<double> y;
    y.reserve(Ny);
    if (nDummyOxLay > 0) y.push_back(-hy - tOx - tDummy);
    y.insert(y.end(), yBot.begin(), yBot.end());
    y.insert(y.end(), ySi.begin(), ySi.end());
    y.insert(y.end(), yTop.begin(), yTop.end());
    if (nDummyOxLay > 0) y.push_back( hy + tOx + tDummy);
    return y;
}

std::vector<double> Mesh3D::zNodesAt(int ix, const NanosheetFET3D& geo) const {
    double x = xGrid[ix];
    double lamU = asymZ ? geo.lambdaU(x) : geo.Lambda(x);
    double lamD = asymZ ? geo.lambdaD(x) : lamU;

    double alpha  = zStretch;
    int nhBot = (nzSi + 1) / 2;
    int nhTop = nzSi - nhBot + 1;
    int nhMax = std::max(nhBot, nhTop);

    auto stretch = [alpha](int N) -> std::vector<double> {
        std::vector<double> s(N);
        for (int i = 0; i < N; ++i) {
            double t = (double)i / (N - 1);
            s[i] = (alpha > 0.0) ? std::tanh(alpha * t) / std::tanh(alpha) : t;
        }
        return s;
    };

    auto f = stretch(nhMax);

    std::vector<double> zBotSi, zTopSi;
    for (int i = nhBot - 1; i >= 0; --i) zBotSi.push_back(-lamD * f[i]);
    for (int i = 1; i < nhTop; ++i)       zTopSi.push_back( lamU * f[i]);

    std::vector<double> zSi;
    zSi.reserve(nzSi);
    zSi.insert(zSi.end(), zBotSi.begin(), zBotSi.end());
    zSi.insert(zSi.end(), zTopSi.begin(), zTopSi.end());

    std::vector<double> zBot(nzOx - 1), zTop(nzOx - 1);
    for (int i = 0; i < nzOx - 1; ++i)
        zBot[i] = (-lamD - tOx) + tOx * i / (nzOx - 1);
    for (int i = 1; i < nzOx; ++i)
        zTop[i-1] = lamU + tOx * i / (nzOx - 1);

    std::vector<double> z;
    z.reserve(Nz);
    if (nDummyOxLay > 0) z.push_back(-lamD - tOx - tDummy);
    z.insert(z.end(), zBot.begin(), zBot.end());
    z.insert(z.end(), zSi.begin(), zSi.end());
    z.insert(z.end(), zTop.begin(), zTop.end());
    if (nDummyOxLay > 0) z.push_back( lamU + tOx + tDummy);
    return z;
}

void Mesh3D::generateNodes(const NanosheetFET3D& geo) {
    yNodes.resize(Nx);
    zNodes.resize(Nx);
    for (int ix = 0; ix < Nx; ++ix) {
        // SD extension slabs inherit cross-section from the adjacent device slice.
        int refIx = ix;
        if (nDummySd > 0) {
            if (ix < nDummySd)       refIx = nDummySd;
            if (ix >= Nx - nDummySd) refIx = Nx - nDummySd - 1;
        }
        yNodes[ix] = yNodesAt(refIx, geo);
        zNodes[ix] = zNodesAt(refIx, geo);
    }

    nodes.resize(nNodes);
    for (int ix = 0; ix < Nx; ++ix)
        for (int iy = 0; iy < Ny; ++iy)
            for (int iz = 0; iz < Nz; ++iz)
                nodes[nidx(ix,iy,iz)] = {xGrid[ix], yNodes[ix][iy], zNodes[ix][iz]};

    // Rounded corners in y-z plane: map each node in the corner zone
    // (|y| > hy-r AND |z| > hz-r) using d_new = max(dy,dz) radial squeeze.
    // Maps Si rectangle edge → arc radius r; outer oxide edge → arc radius r+tOx
    // (conformal oxide thickness preserved through corners).
    if (rCorner > 0.0) {
        for (int ix = 0; ix < Nx; ++ix) {
            int ri = ix;
            if (nDummySd > 0) {
                if (ix < nDummySd)     ri = nDummySd;
                if (ix >= Nx-nDummySd) ri = Nx-nDummySd-1;
            }
            double x   = xGrid[ri];
            double hy  = geo.lambdaY(x);
            double hzU = geo.lambdaU(x);
            double hzD = geo.lambdaD(x);
            double r   = std::min({rCorner, hy, hzU, hzD});
            if (r <= 0.0) continue;
            double cy  = hy - r;

            for (int iy = 0; iy < Ny; ++iy) {
                for (int iz = 0; iz < Nz; ++iz) {
                    auto& nd = nodes[nidx(ix, iy, iz)];
                    double y0 = nd[1], z0 = nd[2];
                    double hz = (z0 >= 0.0) ? hzU : hzD;
                    double cz = hz - r;

                    double ay = std::abs(y0), az = std::abs(z0);
                    if (ay <= cy || az <= cz) continue;

                    double dy = ay - cy, dz = az - cz;
                    double d  = std::sqrt(dy*dy + dz*dz);
                    if (d < 1e-12) continue;

                    double sc = std::max(dy, dz) / d;
                    nd[1] = std::copysign(cy + sc*dy, y0);
                    nd[2] = std::copysign(cz + sc*dz, z0);
                }
            }
        }
        std::cout << "  Corner rounding: r=" << rCorner << " nm applied\n";
    }

    std::cout << "  Nodes: " << nNodes << "\n";
}

void Mesh3D::generateTets() {
    // 6-tet prismatic split everywhere: straight x-aligned flux tubes,
    // no transition detection, no Freudenthal diagonal.
    nTets = (Nx-1) * (Ny-1) * (Nz-1) * 6;
    tets.resize(nTets);

    int izZ0 = nDummyOxLay + nzOx - 1 + nzSi / 2;
    int iyY0 = nDummyOxLay + nyOx - 1 + nySi / 2;
    double xMid = 0.5 * (xGrid[0] + xGrid[Nx-1]);
    bool useLx = geo->mirrorX;

    // lx/ly/lz mirrors keep consistent orientation across symmetry planes.
    // lx is disabled when mirrorX=false so diagonals do not flip at x=0.
    // lz skipped for asymZ (top/bottom physically different).
    auto mk6 = [&](bool lx, bool ly, bool lz) -> std::array<std::array<int,4>,6> {
        int vcomp[8]; for(int i=0;i<8;i++) vcomp[i]=i;
        if (lx)             { int t[8]; for(int i=0;i<8;i++) t[i]=vmapX[vcomp[i]]; memcpy(vcomp,t,32); }
        if (ly)             { int t[8]; for(int i=0;i<8;i++) t[i]=vmapY[vcomp[i]]; memcpy(vcomp,t,32); }
        if (!asymZ && lz)   { int t[8]; for(int i=0;i<8;i++) t[i]=vmapZ[vcomp[i]]; memcpy(vcomp,t,32); }
        std::array<std::array<int,4>,6> out;
        for(int r=0;r<6;r++) for(int c=0;c<4;c++) out[r][c]=vcomp[hex2TetPrism[r][c]];
        return out;
    };

    int t = 0;
    for (int ix = 0; ix < Nx - 1; ++ix) {
        bool lx = useLx && (0.5*(xGrid[ix]+xGrid[ix+1]) < xMid - 1e-12);
        for (int iy = 0; iy < Ny - 1; ++iy) {
            bool ly = (iy < iyY0);
            for (int iz = 0; iz < Nz - 1; ++iz) {
                bool lz = (iz < izZ0);

                int h[8] = {
                    nidx(ix,  iy,  iz  ), nidx(ix+1,iy,  iz  ),
                    nidx(ix+1,iy+1,iz  ), nidx(ix,  iy+1,iz  ),
                    nidx(ix,  iy,  iz+1), nidx(ix+1,iy,  iz+1),
                    nidx(ix+1,iy+1,iz+1), nidx(ix,  iy+1,iz+1)
                };

                auto pat = mk6(lx, ly, lz);
                for (auto& row : pat)
                    tets[t++] = {h[row[0]], h[row[1]], h[row[2]], h[row[3]]};
            }
        }
    }
    assert(t == nTets);
    std::cout << "  Tets: " << nTets << "  (6-tet prismatic, all slabs)\n";
}

void Mesh3D::assignMaterials() {
    tetMat.resize(nTets);
    tetEps.resize(nTets);

    // Si node index ranges (shifted by nDummyOxLay relative to old layout)
    const int siYlo = nDummyOxLay + nyOx - 1;
    const int siYhi = nDummyOxLay + nyOx + nySi - 2;
    const int siZlo = nDummyOxLay + nzOx - 1;
    const int siZhi = nDummyOxLay + nzOx + nzSi - 2;

    int siCount = 0, oxCount = 0, ox1Count = 0, ox3Count = 0;
    const double xDevMin = xGrid[nDummySd];
    const double xDevMax = xGrid[Nx - 1 - nDummySd];

    for (int t = 0; t < nTets; ++t) {
        // ── Source / drain dummy x-slabs (Si region only) ───────────────────
        if (nDummySd > 0) {
            bool inSrc = true, inDrn = true;
            for (int v = 0; v < 4; ++v) {
                int ix = tets[t][v] / (Ny * Nz);
                if (ix > nDummySd)           inSrc = false;
                if (ix < Nx - 1 - nDummySd)  inDrn = false;
            }
            if (inSrc || inDrn) { tetMat[t] = matSi; tetEps[t] = epsSi; ++siCount; continue; }
        }

        // ── Si or SiO2 ──────────────────────────────────────────────────────
        bool isSi = true;
        for (int v = 0; v < 4; ++v) {
            int n  = tets[t][v];
            int iy = (n / Nz) % Ny;
            int iz =  n % Nz;
            if (iy < siYlo || iy > siYhi || iz < siZlo || iz > siZhi) { isSi = false; break; }
        }
        if (isSi) {
            tetMat[t] = matSi; tetEps[t] = epsSi; ++siCount;
        } else {
            int ixLo = Nx, ixHi = 0;
            for (int v = 0; v < 4; ++v) {
                int ix = tets[t][v] / (Ny * Nz);
                if (ix < ixLo) ixLo = ix;
                if (ix > ixHi) ixHi = ix;
            }
            double xm = 0.5 * (xGrid[ixLo] + xGrid[ixHi]);
            if      (tDummy > 0 && xm < xDevMin + tDummy) { tetMat[t] = matOxideSeg1; tetEps[t] = epsOx; ++ox1Count; }
            else if (tDummy > 0 && xm > xDevMax - tDummy) { tetMat[t] = matOxideSeg3; tetEps[t] = epsOx; ++ox3Count; }
            else                                           { tetMat[t] = matSiO2;      tetEps[t] = epsOx; ++oxCount;  }
        }
    }

    std::cout << "  Si: " << siCount
              << "   OxideSeg1: " << ox1Count
              << "   OxideSeg2: " << oxCount
              << "   OxideSeg3: " << ox3Count << "\n";
}

void Mesh3D::extractFaces() {
    std::cout << "  Extracting faces ...\n";

    using FMap = std::unordered_map<FaceKey, std::vector<int>, FaceKeyHash>;
    FMap faceMap;
    faceMap.reserve(nTets * 4);

    for (int t = 0; t < nTets; ++t) {
        auto& tet = tets[t];
        for (int fi = 0; fi < 4; ++fi) {
            FaceKey key(tet[tetFaces[fi][0]],
                        tet[tetFaces[fi][1]],
                        tet[tetFaces[fi][2]]);
            faceMap[key].push_back(t);
        }
    }

    for (auto& [key, tv] : faceMap) {
        std::array<int,3> fn = {key.n[0], key.n[1], key.n[2]};
        if (tv.size() == 2) {
            intFaces.tetI.push_back(tv[0]);
            intFaces.tetJ.push_back(tv[1]);
            intFaces.fn.push_back(fn);
            intFaces.area.push_back(0.0);
            intFaces.normal.push_back({0,0,0});
            intFaces.dist.push_back(0.0);
            intFaces.epsR.push_back(0.0);
        } else if (tv.size() == 1) {
            bndFaces.tet.push_back(tv[0]);
            bndFaces.fn.push_back(fn);
            bndFaces.area.push_back(0.0);
            bndFaces.normal.push_back({0,0,0});
            bndFaces.dist.push_back(0.0);
            bndFaces.fc.push_back({0,0,0});
            bndFaces.epsR.push_back(0.0);
            bndFaces.bc.push_back(classifyBc(fn));
        }
    }
}

int Mesh3D::classifyBc(const std::array<int,3>& fn) const {
    bool src = true, drn = true;
    bool gateY = true, gateY2 = true, gateZ = true, gateZ2 = true;

    for (int n : fn) {
        int ix = n / (Ny * Nz);
        int iy = (n / Nz) % Ny;
        int iz =  n % Nz;
        if (ix != 0)      src    = false;
        if (ix != Nx - 1) drn    = false;
        if (iy != 0)      gateY  = false;
        if (iy != Ny - 1) gateY2 = false;
        if (iz != 0)      gateZ  = false;
        if (iz != Nz - 1) gateZ2 = false;
    }
    if (src)  return bcSource;
    if (drn)  return bcDrain;
    if (gateY || gateY2 || gateZ || gateZ2) return bcGate;
    return bcNeumann;
}

void Mesh3D::computeGeometry() {
    std::cout << "  Computing geometry ...\n";

    tetVol.resize(nTets);
    tetCen.resize(nTets);

    for (int t = 0; t < nTets; ++t) {
        auto& nd = nodes;
        auto& tv = tets[t];
        auto& v0 = nd[tv[0]]; auto& v1 = nd[tv[1]];
        auto& v2 = nd[tv[2]]; auto& v3 = nd[tv[3]];

        double e1[3] = {v1[0]-v0[0], v1[1]-v0[1], v1[2]-v0[2]};
        double e2[3] = {v2[0]-v0[0], v2[1]-v0[1], v2[2]-v0[2]};
        double e3[3] = {v3[0]-v0[0], v3[1]-v0[1], v3[2]-v0[2]};

        double vol = (e1[0]*(e2[1]*e3[2]-e2[2]*e3[1])
                    - e1[1]*(e2[0]*e3[2]-e2[2]*e3[0])
                    + e1[2]*(e2[0]*e3[1]-e2[1]*e3[0])) / 6.0;

        if (vol < 0.0) {
            std::swap(tets[t][2], tets[t][3]);
            vol = -vol;
        }
        tetVol[t] = vol;
        tetCen[t] = {(v0[0]+v1[0]+v2[0]+v3[0])*0.25,
                     (v0[1]+v1[1]+v2[1]+v3[1])*0.25,
                     (v0[2]+v1[2]+v2[2]+v3[2])*0.25};
    }

    int nif = intFaces.size();
    for (int f = 0; f < nif; ++f) {
        auto& fn = intFaces.fn[f];
        auto& p0 = nodes[fn[0]]; auto& p1 = nodes[fn[1]]; auto& p2 = nodes[fn[2]];
        double e1[3] = {p1[0]-p0[0], p1[1]-p0[1], p1[2]-p0[2]};
        double e2[3] = {p2[0]-p0[0], p2[1]-p0[1], p2[2]-p0[2]};
        double nx = e1[1]*e2[2]-e1[2]*e2[1];
        double ny = e1[2]*e2[0]-e1[0]*e2[2];
        double nz = e1[0]*e2[1]-e1[1]*e2[0];
        double nl = std::sqrt(nx*nx+ny*ny+nz*nz);
        intFaces.area[f] = 0.5 * nl;
        double safe = (nl > 1e-30) ? 1.0/nl : 0.0;
        intFaces.normal[f] = {nx*safe, ny*safe, nz*safe};

        int ti = intFaces.tetI[f], tj = intFaces.tetJ[f];
        double dx = tetCen[tj][0]-tetCen[ti][0];
        double dy = tetCen[tj][1]-tetCen[ti][1];
        double dz = tetCen[tj][2]-tetCen[ti][2];
        intFaces.dist[f] = std::max(std::sqrt(dx*dx+dy*dy+dz*dz), 1e-12);

        auto& nhat = intFaces.normal[f];
        double dot = nhat[0]*dx + nhat[1]*dy + nhat[2]*dz;
        if (dot < 0.0) { nhat[0]=-nhat[0]; nhat[1]=-nhat[1]; nhat[2]=-nhat[2]; }

        double ei = tetEps[ti], ej = tetEps[tj];
        intFaces.epsR[f] = 2.0*ei*ej/(ei+ej);
    }

    int nbf = bndFaces.size();
    for (int f = 0; f < nbf; ++f) {
        auto& fn = bndFaces.fn[f];
        auto& p0 = nodes[fn[0]]; auto& p1 = nodes[fn[1]]; auto& p2 = nodes[fn[2]];
        double e1[3] = {p1[0]-p0[0], p1[1]-p0[1], p1[2]-p0[2]};
        double e2[3] = {p2[0]-p0[0], p2[1]-p0[1], p2[2]-p0[2]};
        double nx = e1[1]*e2[2]-e1[2]*e2[1];
        double ny = e1[2]*e2[0]-e1[0]*e2[2];
        double nz = e1[0]*e2[1]-e1[1]*e2[0];
        double nl = std::sqrt(nx*nx+ny*ny+nz*nz);
        bndFaces.area[f] = 0.5*nl;
        double safe = (nl>1e-30)?1.0/nl:0.0;
        bndFaces.normal[f] = {nx*safe, ny*safe, nz*safe};

        double fcx = (p0[0]+p1[0]+p2[0])/3.0;
        double fcy = (p0[1]+p1[1]+p2[1])/3.0;
        double fcz = (p0[2]+p1[2]+p2[2])/3.0;
        bndFaces.fc[f] = {fcx, fcy, fcz};

        int tc = bndFaces.tet[f];
        double dx = fcx-tetCen[tc][0];
        double dy = fcy-tetCen[tc][1];
        double dz = fcz-tetCen[tc][2];
        bndFaces.dist[f] = std::max(std::sqrt(dx*dx+dy*dy+dz*dz), 1e-12);

        auto& nhat = bndFaces.normal[f];
        double dot = nhat[0]*dx + nhat[1]*dy + nhat[2]*dz;
        if (dot < 0.0) { nhat[0]=-nhat[0]; nhat[1]=-nhat[1]; nhat[2]=-nhat[2]; }

        bndFaces.epsR[f] = tetEps[tc];
    }
}

void Mesh3D::buildSiIndex() {
    // Exclude dummy source/drain x-slabs from the Si physics index.
    int ixLo = nDummySd, ixHi = Nx - nDummySd;
    nSi = (ixHi - ixLo) * nySi * nzSi;
    siGlobal.resize(nSi);
    siIx.resize(nSi);
    siIy.resize(nSi);
    siIz.resize(nSi);

    int k = 0;
    for (int ix = ixLo; ix < ixHi; ++ix)
        for (int iy = 0; iy < nySi; ++iy)
            for (int iz = 0; iz < nzSi; ++iz) {
                int giy = iy + (nDummyOxLay + nyOx - 1);
                int giz = iz + (nDummyOxLay + nzOx - 1);
                siGlobal[k] = nidx(ix, giy, giz);
                siIx[k] = ix - ixLo;
                siIy[k] = iy;
                siIz[k] = iz;
                ++k;
            }
}

std::vector<bool> Mesh3D::siMask() const {
    std::vector<bool> m(nTets);
    for (int i = 0; i < nTets; ++i) m[i] = (tetMat[i] == matSi);
    return m;
}

std::vector<int> Mesh3D::siNodesIdx() const { return siGlobal; }

std::vector<bool> Mesh3D::gateFaceMask(double gateXExtent) const {
    int nbf = bndFaces.size();
    std::vector<bool> m(nbf, false);
    for (int f = 0; f < nbf; ++f) {
        if (bndFaces.bc[f] != bcGate) continue;
        if (gateXExtent >= 0.0 && std::abs(bndFaces.fc[f][0]) > gateXExtent) continue;
        m[f] = true;
    }
    return m;
}

// ── Flux tube integrity check ─────────────────────────────────────────────────
bool Mesh3D::checkFluxTubes() const {
    // For the 6-tet prismatic split, every x-interface at ix (0..Nx-1) must be
    // tiled by exactly 2*(Ny-1)*(Nz-1) end-cap interior faces — triangles with
    // all 3 nodes at the same x-slice. Their summed area must equal ySpan*zSpan.
    // Failure means gap or overlap in the flux tube → broken or twisted mesh.

    const int expectedCaps = 2 * (Ny - 1) * (Nz - 1);

    std::vector<double> capArea (Nx, 0.0);
    std::vector<int>    capCount(Nx, 0);
    int nZeroArea = 0;
    int nZeroDist = 0;
    int nif = intFaces.size();

    for (int f = 0; f < nif; ++f) {
        if (intFaces.area[f] < 1e-12) ++nZeroArea;
        if (intFaces.dist[f] < 1e-10) ++nZeroDist;

        auto& fn = intFaces.fn[f];
        int ix0 = fn[0] / (Ny * Nz);
        int ix1 = fn[1] / (Ny * Nz);
        int ix2 = fn[2] / (Ny * Nz);
        if (ix0 == ix1 && ix1 == ix2) {
            capArea [ix0] += intFaces.area[f];
            capCount[ix0] += 1;
        }
    }

    // ix=0 and ix=Nx-1 are source/drain boundary planes — their end-caps are
    // boundary faces (not interior), so skip those two extremes.
    bool ok = true;
    int  nBroken = 0;
    for (int ix = 1; ix < Nx - 1; ++ix) {
        double ySpan        = yNodes[ix].back() - yNodes[ix].front();
        double zSpan        = zNodes[ix].back() - zNodes[ix].front();
        double expectedArea = ySpan * zSpan;
        if (rCorner > 0.0) {
            int ri = ix;
            if (nDummySd > 0) {
                if (ix < nDummySd)     ri = nDummySd;
                if (ix >= Nx-nDummySd) ri = Nx-nDummySd-1;
            }
            double x    = xGrid[ri];
            double r    = std::min({rCorner, geo->lambdaY(x),
                                    geo->lambdaU(x), geo->lambdaD(x)});
            double rOut = r + tOx;
            expectedArea -= (4.0 - 3.141592653589793) * rOut * rOut;
        }

        // With rounded corners the discretized area differs from the analytic
        // quarter-disk formula by O(h²); relax to 2% tolerance.
        double areaTol = (rCorner > 0.0) ? 0.02 : 1e-6;
        bool countOk = (capCount[ix] == expectedCaps);
        bool areaOk  = (std::abs(capArea[ix] - expectedArea) <
                        areaTol * expectedArea);
        if (!countOk || !areaOk) {
            ok = false;
            ++nBroken;
            std::cout << "  [BROKEN] ix=" << ix
                      << "  caps=" << capCount[ix] << "/" << expectedCaps
                      << "  area=" << capArea[ix]  << "/" << expectedArea
                      << " nm^2\n";
        }
    }
    if (nZeroArea > 0 || nZeroDist > 0) ok = false;

    std::cout << "\n=== Flux Tube Check ===\n";
    if (ok) {
        std::cout << "  PASS — all " << (Nx-2) << " internal x-interfaces clean\n";
        std::cout << "  End-caps per interface: " << expectedCaps
                  << "  (2 x " << (Ny-1) << " x " << (Nz-1) << ")\n";
        std::cout << "  No broken tubes, no clogged tubes, no zero-area faces\n";
    } else {
        if (nBroken   > 0) std::cout << "  FAIL — " << nBroken
                                     << "/" << (Nx-2) << " interfaces broken\n";
        if (nZeroArea > 0) std::cout << "  FAIL — " << nZeroArea
                                     << " zero-area interior faces (clogged)\n";
        if (nZeroDist > 0) std::cout << "  FAIL — " << nZeroDist
                                     << " zero centroid-distance pairs\n";
    }
    return ok;
}

void Mesh3D::meshStats() const {
    double vmin=tetVol[0], vmax=tetVol[0], vsum=0.0;
    for (double v : tetVol) { vmin=std::min(vmin,v); vmax=std::max(vmax,v); vsum+=v; }
    double vmean = vsum / nTets;

    int nif = intFaces.size();
    double amin=intFaces.area[0], amax=intFaces.area[0];
    double dmin=intFaces.dist[0], dmax=intFaces.dist[0];
    for (int f=0;f<nif;++f) {
        amin=std::min(amin,intFaces.area[f]); amax=std::max(amax,intFaces.area[f]);
        dmin=std::min(dmin,intFaces.dist[f]); dmax=std::max(dmax,intFaces.dist[f]);
    }

    double thetaSum=0.0, thetaMax=0.0;
    for (int f=0;f<nif;++f) {
        int ti=intFaces.tetI[f], tj=intFaces.tetJ[f];
        double dx=tetCen[tj][0]-tetCen[ti][0];
        double dy=tetCen[tj][1]-tetCen[ti][1];
        double dz=tetCen[tj][2]-tetCen[ti][2];
        double dl=std::sqrt(dx*dx+dy*dy+dz*dz);
        if (dl < 1e-30) continue;
        auto& n=intFaces.normal[f];
        double cosT=std::abs(n[0]*dx+n[1]*dy+n[2]*dz)/dl;
        double theta=std::acos(std::min(cosT,1.0))*180.0/3.141592653589793;
        thetaSum+=theta; thetaMax=std::max(thetaMax,theta);
    }
    double thetaMean = (nif>0) ? thetaSum/nif : 0.0;

    std::cout << "\n=== Mesh Quality ===\n";
    std::cout << "  Nodes        : " << nNodes << "\n";
    std::cout << "  Tets         : " << nTets << "\n";
    std::cout << "  Interior faces: " << nif << "\n";
    std::cout << "  Tet volume   : min=" << vmin << "  max=" << vmax
              << "  mean=" << vmean << "  nm^3\n";
    std::cout << "  Face area    : min=" << amin << "  max=" << amax << "  nm^2\n";
    std::cout << "  Centroid dist: min=" << dmin << "  max=" << dmax << "  nm\n";
    std::cout << "  Non-orthogon.: mean=" << thetaMean << " deg  max="
              << thetaMax << " deg  (0=perfect, <15=good)\n";

    checkFluxTubes();
}

void Mesh3D::toVtu(const std::string& path) const {
    int nPts = (int)nodes.size();
    int nCel = nTets;

    int nif = intFaces.size();
    std::vector<float>  nonortho(nCel, 0.0f);
    std::vector<int>    count(nCel, 0);
    for (int f=0;f<nif;++f) {
        int ti=intFaces.tetI[f], tj=intFaces.tetJ[f];
        double dx=tetCen[tj][0]-tetCen[ti][0];
        double dy=tetCen[tj][1]-tetCen[ti][1];
        double dz=tetCen[tj][2]-tetCen[ti][2];
        double dl=std::sqrt(dx*dx+dy*dy+dz*dz);
        if (dl<1e-30) continue;
        auto& n=intFaces.normal[f];
        double cosT=std::abs(n[0]*dx+n[1]*dy+n[2]*dz)/dl;
        float ang=(float)(std::acos(std::min(cosT,1.0))*180.0/3.141592653589793);
        nonortho[ti]+=ang; count[ti]++;
        nonortho[tj]+=ang; count[tj]++;
    }
    for (int t=0;t<nCel;++t)
        if (count[t]>0) nonortho[t]/=count[t];

    if (!checkFluxTubes())
        throw std::runtime_error("Flux tube check failed — VTU not written.");

    std::ofstream f(path);
    if (!f) throw std::runtime_error("Cannot open " + path);

    f << "<?xml version=\"1.0\"?>\n"
      << "<VTKFile type=\"UnstructuredGrid\" version=\"0.1\" byte_order=\"LittleEndian\">\n"
      << "  <UnstructuredGrid>\n"
      << "    <Piece NumberOfPoints=\"" << nPts
      << "\" NumberOfCells=\"" << nCel << "\">\n";

    f << "      <Points>\n"
      << "        <DataArray type=\"Float64\" NumberOfComponents=\"3\" format=\"ascii\">\n";
    for (auto& p : nodes)
        f << "          " << p[0] << " " << p[1] << " " << p[2] << "\n";
    f << "        </DataArray>\n"
      << "      </Points>\n";

    f << "      <Cells>\n"
      << "        <DataArray type=\"Int32\" Name=\"connectivity\" format=\"ascii\">\n";
    for (auto& t : tets)
        f << "          " << t[0] << " " << t[1] << " " << t[2] << " " << t[3] << "\n";
    f << "        </DataArray>\n"
      << "        <DataArray type=\"Int32\" Name=\"offsets\" format=\"ascii\">\n          ";
    for (int i=1;i<=nCel;++i) f << i*4 << " ";
    f << "\n        </DataArray>\n"
      << "        <DataArray type=\"UInt8\" Name=\"types\" format=\"ascii\">\n          ";
    for (int i=0;i<nCel;++i) f << "10 ";
    f << "\n        </DataArray>\n"
      << "      </Cells>\n";

    f << "      <CellData>\n"
      << "        <DataArray type=\"Int8\" Name=\"material\" format=\"ascii\">\n          ";
    for (int t=0;t<nCel;++t) f << (int)tetMat[t] << " ";
    f << "\n        </DataArray>\n"
      << "        <DataArray type=\"Float32\" Name=\"volume_nm3\" format=\"ascii\">\n          ";
    for (int t=0;t<nCel;++t) f << (float)tetVol[t] << " ";
    f << "\n        </DataArray>\n"
      << "        <DataArray type=\"Float32\" Name=\"nonortho_deg\" format=\"ascii\">\n          ";
    for (int t=0;t<nCel;++t) f << nonortho[t] << " ";
    f << "\n        </DataArray>\n"
      << "      </CellData>\n";

    f << "    </Piece>\n  </UnstructuredGrid>\n</VTKFile>\n";
    std::cout << "  VTU written: " << path << "  (" << nPts << " nodes, "
              << nCel << " tets)\n";
}

// ── DFISE export (.grd + .dat) ────────────────────────────────────────────────

} // namespace qt
