/**
 * mesh_gen.cpp  --  Standalone mesh generator for GAA nanosheet FET.
 *
 * Usage: mesh_gen [options]
 *
 * Device geometry
 *   --T_SD=<nm>      Full Si thickness at S/D        (default 10.0)
 *   --T_ch=<nm>      Full Si thickness at channel     (default  5.0)
 *   --x_ch=<nm>      Half channel length              (default  7.5)
 *   --x_sd=<nm>      Half S/D start position          (default 12.5)
 *   --W_z=<nm>       Nanosheet width in y (fixed)     (default 10.0)
 *   --L_tot=<nm>     Total device length              (default 35.0)
 *
 * Asymmetric top/bottom profiles
 *   --T_SD_U=<nm>    Top S/D thickness                (default T_SD)
 *   --T_SD_D=<nm>    Bottom S/D thickness             (default T_SD)
 *   --T_ch_U=<nm>    Top channel thickness            (default T_ch)
 *   --T_ch_D=<nm>    Bottom channel thickness         (default T_ch)
 *
 * x-grid
 *   --Nx=<int>       Uniform x-points                 (default 17)
 *   --x_grid=refined  Non-uniform: denser near transitions
 *
 * Mesh resolution (per x-slice)
 *   --Ny_Si=<int>    Si nodes in y  (odd; default 7)
 *   --Nz_Si=<int>    Si nodes in z  (odd; default 7)
 *   --Ny_ox=<int>    Oxide nodes per side in y        (default 3)
 *   --Nz_ox=<int>    Oxide nodes per side in z        (default 3)
 *   --t_ox=<nm>      Gate oxide thickness             (default 1.0)
 *   --z_stretch=<f>  Tanh clustering factor           (default 2.0; 0=uniform)
 *
 * Output
 *   --vtu=<path>     Export mesh to .vtu for ParaView (optional)
 *   --no-stats       Skip quality statistics
 */

#include <iostream>
#include <sstream>
#include <string>
#include <vector>
#include <cmath>
#include <algorithm>
#include <set>
#include <stdexcept>
#include <limits>

#include "geometry.hpp"
#include "tabulated_geometry.hpp"
#include "mesh.hpp"

namespace {

struct Args {
    double tSD    = 10.0;
    double tCh    =  5.0;
    double xCh    =  7.5;
    double xSD    = 12.5;
    double wZ     = 10.0;
    double wSD    = -1.0;
    double lTot   = 35.0;

    double tSDU   = std::numeric_limits<double>::quiet_NaN();
    double tSDD   = std::numeric_limits<double>::quiet_NaN();
    double tChU   = std::numeric_limits<double>::quiet_NaN();
    double tChD   = std::numeric_limits<double>::quiet_NaN();

    int    Nx       = 17;
    bool   refined  = false;

    int    nySi     = 7;
    int    nzSi     = 7;
    int    nyOx     = 3;
    int    nzOx     = 3;
    double tOx      = 1.0;
    double zStretch = 2.0;
    double tDummy   = 0.0;

    double rCorner   = 0.0;

    std::string interfacePath;
    std::string vtuPath;
    bool   printStats = true;

    static double toDbl(const std::string& s) { return std::stod(s); }
    static int    toInt(const std::string& s) { return std::stoi(s); }

    void parse(int argc, char* argv[]) {
        for (int i = 1; i < argc; ++i) {
            std::string a = argv[i];
            if (a == "--help" || a == "-h") { printHelp(); std::exit(0); }
            if (a == "--no-stats") { printStats = false; continue; }
            if (a == "--x_grid=refined") { refined = true; continue; }

            auto eq = a.find('=');
            if (eq == std::string::npos) throw std::invalid_argument("Unknown flag: " + a);
            std::string key = a.substr(2, eq - 2);
            std::string val = a.substr(eq + 1);

            if      (key=="T_SD")      tSD       = toDbl(val);
            else if (key=="T_ch")      tCh       = toDbl(val);
            else if (key=="x_ch")      xCh       = toDbl(val);
            else if (key=="x_sd")      xSD       = toDbl(val);
            else if (key=="W_z")       wZ        = toDbl(val);
            else if (key=="W_SD")      wSD       = toDbl(val);
            else if (key=="L_tot")     lTot      = toDbl(val);
            else if (key=="T_SD_U")    tSDU      = toDbl(val);
            else if (key=="T_SD_D")    tSDD      = toDbl(val);
            else if (key=="T_ch_U")    tChU      = toDbl(val);
            else if (key=="T_ch_D")    tChD      = toDbl(val);
            else if (key=="Nx")        Nx        = toInt(val);
            else if (key=="Ny_Si")     nySi      = toInt(val);
            else if (key=="Nz_Si")     nzSi      = toInt(val);
            else if (key=="Ny_ox")     nyOx      = toInt(val);
            else if (key=="Nz_ox")     nzOx      = toInt(val);
            else if (key=="t_ox")      tOx       = toDbl(val);
            else if (key=="z_stretch") zStretch  = toDbl(val);
            else if (key=="T_dummy")   tDummy    = toDbl(val);
            else if (key=="r_corner")  rCorner   = toDbl(val);
            else if (key=="interface") interfacePath = val;
            else if (key=="vtu")       vtuPath   = val;
            else if (key=="x_grid") {
                if (val != "uniform") throw std::invalid_argument("Unknown x_grid mode: " + val);
            }
            else throw std::invalid_argument("Unknown option: --" + key);
        }

        auto fill = [](double& v, double def) { if (std::isnan(v)) v = def; };
        fill(tSDU, tSD); fill(tSDD, tSD);
        fill(tChU, tCh); fill(tChD, tCh);
    }

    bool isAsymmetric() const {
        return (tSDU != tSDD) || (tChU != tChD);
    }

    static void printHelp() {
        std::cout <<
R"(mesh_gen -- GAA nanosheet FET tetrahedral mesh generator

Usage: mesh_gen [options]

Device geometry
  --T_SD=<nm>      Full Si thickness at S/D        (default 10.0)
  --T_ch=<nm>      Full Si thickness at channel     (default  5.0)
  --x_ch=<nm>      Half channel length              (default  7.5)
  --x_sd=<nm>      Half S/D start position          (default 12.5)
  --W_z=<nm>       Nanosheet width in y at channel  (default 10.0)
  --W_SD=<nm>      Nanosheet width in y at S/D      (default = W_z, uniform)
  --L_tot=<nm>     Total device length              (default 35.0)

Asymmetric top/bottom profiles
  --T_SD_U=<nm>    Top S/D thickness                (default T_SD)
  --T_SD_D=<nm>    Bottom S/D thickness             (default T_SD)
  --T_ch_U=<nm>    Top channel thickness            (default T_ch)
  --T_ch_D=<nm>    Bottom channel thickness         (default T_ch)

x-grid
  --Nx=<int>       Number of uniform x-grid points  (default 17)
  --x_grid=refined Non-uniform: denser near x_ch, x_sd transitions

Mesh resolution per x-slice
  --Ny_Si=<int>    Si nodes in y (odd)              (default 7)
  --Nz_Si=<int>    Si nodes in z (odd)              (default 7)
  --Ny_ox=<int>    Oxide nodes per side in y        (default 3)
  --Nz_ox=<int>    Oxide nodes per side in z        (default 3)
  --t_ox=<nm>      Gate oxide thickness             (default 1.0)
  --z_stretch=<f>  Tanh clustering factor (0=uniform, default 2.0)
  --T_dummy=<nm>   Dummy layer thickness: dummyOx (outside SiO2),
                   dummySource (source end), dummyDrain (drain end)
                   (default 0 = disabled)
  --r_corner=<nm>  Si corner rounding radius in y-z plane (default 0 = rectangular)

Output
  --vtu=<path>     Export to .vtu for ParaView/VisIt
  --no-stats       Skip mesh quality statistics
  --help           This message
)";
    }
};

std::vector<double> makeXGrid(const Args& a) {
    if (!a.refined) {
        std::vector<double> xg(a.Nx);
        double lo = -a.lTot/2.0, hi = a.lTot/2.0;
        for (int i = 0; i < a.Nx; ++i)
            xg[i] = lo + (hi - lo) * i / (a.Nx - 1);
        return xg;
    }
    auto linspace = [](double lo, double hi, int n) {
        std::vector<double> v(n);
        for (int i = 0; i < n; ++i) v[i] = lo + (hi - lo) * i / (n - 1);
        return v;
    };

    std::set<double> ptsSet;
    auto add = [&](std::vector<double> v) {
        for (double x : v) ptsSet.insert(x);
    };
    add(linspace(0.0,     a.xCh, 6));
    add(linspace(a.xCh,  a.xSD, 7));
    add(linspace(a.xSD,  a.lTot/2.0, 4));

    std::vector<double> xr(ptsSet.begin(), ptsSet.end());
    std::vector<double> xg;
    xg.reserve(2 * (int)xr.size() - 1);
    for (int i = (int)xr.size() - 1; i >= 1; --i) xg.push_back(-xr[i]);
    for (double x : xr) xg.push_back(x);
    return xg;
}

} // anonymous namespace

int main(int argc, char* argv[]) {
    Args a;
    try { a.parse(argc, argv); }
    catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << "\n";
        std::cerr << "Run with --help for usage.\n";
        return 1;
    }

    std::cout << "=== GAA Nanosheet FET Mesh Generator ===\n";
    std::cout << "  Device: T_ch=" << a.tCh << " nm  T_SD=" << a.tSD << " nm"
              << "  x_ch=" << a.xCh << " nm  x_sd=" << a.xSD << " nm"
              << "  W_z=" << a.wZ << " nm";
    if (a.wSD > 0.0) std::cout << "  W_SD=" << a.wSD << " nm";
    std::cout << "  L_tot=" << a.lTot << " nm\n";
    if (a.isAsymmetric()) {
        std::cout << "  Asymmetric: T_ch_U=" << a.tChU << "  T_ch_D=" << a.tChD
                  << "  T_SD_U=" << a.tSDU << "  T_SD_D=" << a.tSDD << " nm\n";
    }
    std::cout << "  Grid: " << (a.refined ? "refined (non-uniform)" : "uniform")
              << "  t_ox=" << a.tOx << " nm  z_stretch=" << a.zStretch << "\n";
    std::cout << "  Resolution: Ny_Si=" << a.nySi << "  Nz_Si=" << a.nzSi
              << "  Ny_ox=" << a.nyOx << "  Nz_ox=" << a.nzOx << "\n";
    if (a.rCorner > 0.0)
        std::cout << "  Corner rounding: r_corner=" << a.rCorner << " nm\n";

    auto xg = makeXGrid(a);
    std::cout << "  x-grid: " << xg.size() << " points  ["
              << xg.front() << ", " << xg.back() << "] nm\n";

    if (!a.interfacePath.empty()) {
        std::cout << "  Mode: TABULATED (TabulatedFET3D from \"" << a.interfacePath << "\")\n";
        qt::TabulatedFET3D geo = qt::TabulatedFET3D::load(a.interfacePath, xg);
        std::cout << "  Interface: " << geo.slices.size() << " x-slices loaded\n";
        qt::Mesh3D mesh(xg, geo,
                        a.nySi, a.nzSi, a.nyOx, a.nzOx,
                        a.tOx, a.zStretch, a.tDummy, a.rCorner);
        if (a.printStats)           mesh.meshStats();
        if (!a.vtuPath.empty())     mesh.toVtu(a.vtuPath);
    } else if (a.isAsymmetric()) {
        std::cout << "  Mode: ASYMMETRIC (NanosheetFET3DAsym)\n";
        qt::NanosheetFET3DAsym geo(
            a.tChU, a.tChD,
            a.tSDU, a.tSDD,
            a.xCh, a.xSD, a.wZ, xg, a.wSD);
        qt::Mesh3D mesh(xg, geo,
                        a.nySi, a.nzSi, a.nyOx, a.nzOx,
                        a.tOx, a.zStretch, a.tDummy, a.rCorner);
        if (a.printStats)           mesh.meshStats();
        if (!a.vtuPath.empty())     mesh.toVtu(a.vtuPath);
    } else {
        std::cout << "  Mode: SYMMETRIC (NanosheetFET3D)\n";
        qt::NanosheetFET3D geo(a.tSD, a.tCh, a.xCh, a.xSD, a.wZ, xg, a.wSD);
        qt::Mesh3D mesh(xg, geo,
                        a.nySi, a.nzSi, a.nyOx, a.nzOx,
                        a.tOx, a.zStretch, a.tDummy, a.rCorner);
        if (a.printStats)           mesh.meshStats();
        if (!a.vtuPath.empty())     mesh.toVtu(a.vtuPath);
    }

    std::cout << "=== Done ===\n";
    return 0;
}