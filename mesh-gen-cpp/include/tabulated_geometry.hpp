#pragma once
// TabulatedFET3D: data-driven Si/oxide interface from a 3-column ASCII file.
// Replaces the analytical Lambda(x) blending with piecewise-linear interpolation.
// File format:  x[nm]  y[nm]  z[nm]   (one interface point per line, # = comment)
// Convention: channel center at (y=0, z=0); yHalf=max|y|, zTop=max(z), zBot=max(-z)
// at each x-slice.  tOx (--t_ox) still controls the oxide layer thickness.

#include "geometry.hpp"
#include <fstream>
#include <sstream>
#include <stdexcept>
#include <algorithm>
#include <cmath>

namespace qt {

struct TabulatedFET3D : NanosheetFET3D {

    struct Slice {
        double x;
        double yHalf;  // lambdaY at this x  (max |y| of interface points)
        double zTop;   // lambdaU at this x  (max  z  of interface points)
        double zBot;   // lambdaD at this x  (max -z  of interface points)
    };

    std::vector<Slice> slices;  // sorted ascending by x

    // Load from a 3-column ASCII file.  xGrid is the transport-direction grid
    // used by Mesh3D (determines which x values are queried).
    // mirrorX: set true only if the device is exactly x-symmetric about x=0.
    static TabulatedFET3D load(const std::string& path,
                               const std::vector<double>& xGrid,
                               bool mirrorX = false) {
        auto sl = parseFile(path);
        double maxY = 0.0;
        for (auto& s : sl) maxY = std::max(maxY, s.yHalf);
        return TabulatedFET3D(std::move(sl), 2.0 * maxY, xGrid, mirrorX);
    }

    // ── Virtual overrides ────────────────────────────────────────────────────
    double Lambda(double x)       const override { return 0.5*(lambdaU(x)+lambdaD(x)); }
    double lambdaY(double x)      const override { return interpField(x, 0); }
    double lambdaU(double x)      const override { return interpField(x, 1); }
    double lambdaD(double x)      const override { return interpField(x, 2); }

    bool isAsymmetric() const override {
        for (auto& s : slices) {
            double sum = s.zTop + s.zBot;
            if (std::abs(s.zTop - s.zBot) > 1e-6 * (sum + 1e-30))
                return true;
        }
        return false;
    }

private:
    TabulatedFET3D(std::vector<Slice> sl, double maxWZ,
                   const std::vector<double>& xGrid, bool mirrorX)
        : NanosheetFET3D(1.0, 1.0, 0.0, 1.0, maxWZ, xGrid, -1.0, mirrorX),
          slices(std::move(sl))
    {}

    // Piecewise-linear interpolation.  field: 0=yHalf  1=zTop  2=zBot
    double interpField(double x, int field) const {
        auto get = [&](const Slice& s) -> double {
            return field == 0 ? s.yHalf : field == 1 ? s.zTop : s.zBot;
        };
        if (x <= slices.front().x) return get(slices.front());
        if (x >= slices.back().x)  return get(slices.back());
        auto it = std::lower_bound(slices.begin(), slices.end(), x,
                                   [](const Slice& s, double v){ return s.x < v; });
        const Slice& hi = *it;
        const Slice& lo = *(it - 1);
        double t = (x - lo.x) / (hi.x - lo.x);
        return get(lo) + t * (get(hi) - get(lo));
    }

    // Parse the ASCII file: group points by x, compute bounding half-extents.
    static std::vector<Slice> parseFile(const std::string& path) {
        std::ifstream f(path);
        if (!f) throw std::runtime_error("Cannot open interface file: " + path);

        struct Pt { double x, y, z; };
        std::vector<Pt> pts;
        std::string line;
        while (std::getline(f, line)) {
            if (line.empty() || line[0] == '#') continue;
            std::istringstream ss(line);
            double x, y, z;
            if (ss >> x >> y >> z) pts.push_back({x, y, z});
        }
        if (pts.empty())
            throw std::runtime_error("Interface file has no data: " + path);

        std::sort(pts.begin(), pts.end(),
                  [](const Pt& a, const Pt& b){ return a.x < b.x; });

        double xRange = pts.back().x - pts.front().x;
        double tol    = (xRange > 0.0) ? xRange * 1e-8 : 1e-10;

        std::vector<Slice> slices;
        int i = 0;
        while (i < (int)pts.size()) {
            double xv    = pts[i].x;
            double yHalf = 0.0;
            double zTop  = pts[i].z;
            double zBot  = -pts[i].z;
            int j = i;
            while (j < (int)pts.size() && pts[j].x - xv < tol) {
                yHalf = std::max(yHalf, std::abs(pts[j].y));
                zTop  = std::max(zTop,  pts[j].z);
                zBot  = std::max(zBot, -pts[j].z);
                ++j;
            }
            slices.push_back({xv, yHalf, zTop, zBot});
            i = j;
        }

        if (slices.size() < 2)
            throw std::runtime_error("Interface file needs at least 2 distinct x-slices.");

        return slices;
    }
};

} // namespace qt