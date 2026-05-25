#pragma once
// 3D tetrahedral BIM mesh for GAA nanosheet FET. Units: nm.

#include <vector>
#include <array>
#include <cmath>
#include <algorithm>
#include <unordered_map>
#include <string>
#include <cstdint>
#include <fstream>
#include <iostream>
#include "constants.hpp"
#include "geometry.hpp"

namespace qt {

struct FaceKey {
    int n[3];
    FaceKey(int a, int b, int c) {
        n[0]=a; n[1]=b; n[2]=c;
        std::sort(n, n+3);
    }
    bool operator==(const FaceKey& o) const {
        return n[0]==o.n[0] && n[1]==o.n[1] && n[2]==o.n[2];
    }
};
struct FaceKeyHash {
    size_t operator()(const FaceKey& k) const {
        size_t h = (size_t)k.n[0];
        h ^= (size_t)k.n[1] * 2654435761ULL;
        h ^= (size_t)k.n[2] * 805459861ULL;
        return h;
    }
};

struct IntFaces {
    std::vector<int>    tetI, tetJ;
    std::vector<double> area;
    std::vector<std::array<double,3>> normal;
    std::vector<double> dist;
    std::vector<double> epsR;
    std::vector<std::array<int,3>> fn;
    int size() const { return (int)tetI.size(); }
};

struct BndFaces {
    std::vector<int>    tet;
    std::vector<std::array<int,3>> fn;
    std::vector<double> area;
    std::vector<std::array<double,3>> normal;
    std::vector<double> dist;
    std::vector<std::array<double,3>> fc;
    std::vector<double> epsR;
    std::vector<int>    bc;
    int size() const { return (int)tet.size(); }
};

class Mesh3D {
public:
    int Nx, Ny, Nz;
    int nySi, nzSi, nyOx, nzOx;
    int nNodes, nTets;
    double tOx, wZ, zStretch;
    double tDummy;
    double rCorner;    // Si corner rounding radius in y-z plane (0 = rectangular)
    int nDummySd;      // extra x-slab per side (0 or 1)
    int nDummyOxLay;   // extra y/z node layer per side (0 or 1)
    bool asymZ;

    std::vector<double> xGrid;
    std::vector<std::array<double,3>> nodes;
    std::vector<std::vector<double>> yNodes;
    std::vector<std::vector<double>> zNodes;

    std::vector<std::array<int,4>> tets;
    std::vector<int8_t>  tetMat;
    std::vector<double>  tetEps;
    std::vector<double>  tetVol;
    std::vector<std::array<double,3>> tetCen;

    IntFaces intFaces;
    BndFaces bndFaces;

    std::vector<int> siGlobal;
    std::vector<int> siIx;
    std::vector<int> siIy;
    std::vector<int> siIz;
    int nSi;

    Mesh3D(const std::vector<double>& xGrid,
           const NanosheetFET3D& geoRef,
           int nySi=7, int nzSi=7,
           int nyOx=3, int nzOx=3,
           double tOx=1.0,
           double zStretch=2.0,
           double tDummy=0.0,
           double rCorner=0.0);

    inline int nidx(int ix, int iy, int iz) const {
        return ix * Ny * Nz + iy * Nz + iz;
    }
    inline void gridIdx(int flat, int& ix, int& iy, int& iz) const {
        iz = flat % Nz;
        iy = (flat / Nz) % Ny;
        ix = flat / (Ny * Nz);
    }

    std::vector<bool> siMask() const;
    std::vector<int>  siNodesIdx() const;
    std::vector<bool> gateFaceMask(double gateXExtent = -1.0) const;

    // Returns true if all tubes pass; prints per-slice diagnostics on failure.
    // Called automatically by toVtu() — throws on failure.
    bool checkFluxTubes() const;

    void meshStats() const;
    void toVtu(const std::string& path) const;


private:
    const NanosheetFET3D* geo;

    static const int hex2TetPrism[6][4];
    static const int vmapX[8], vmapY[8], vmapZ[8];
    static const int tetFaces[4][3];

    std::vector<double> yNodesAt(int ix, const NanosheetFET3D& geo) const;
    std::vector<double> zNodesAt(int ix, const NanosheetFET3D& geo) const;
    void generateNodes(const NanosheetFET3D& geo);
    void generateTets();
    void assignMaterials();
    void extractFaces();
    int  classifyBc(const std::array<int,3>& face) const;
    void computeGeometry();
    void buildSiIndex();
};

} // namespace qt