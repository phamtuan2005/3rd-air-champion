#pragma once
#ifndef QT_CONSTANTS_HPP
#define QT_CONSTANTS_HPP

namespace qt {

constexpr double epsSi    = 11.7;   // Si relative permittivity
constexpr double epsOx    =  3.9;   // SiO2 relative permittivity
constexpr double epsDummy =  1.0;   // dummy contact placeholder

constexpr int matSiO2        = 0;  // OxideSeg2 (middle)
constexpr int matSi          = 1;
constexpr int matOxideSeg1   = 2;  // source-side oxide slab (thickness = T_dummy)
constexpr int matOxideSeg3   = 3;  // drain-side oxide slab  (thickness = T_dummy)

constexpr int bcNeumann = 0;
constexpr int bcGate    = 1;
constexpr int bcSource  = 2;
constexpr int bcDrain   = 3;

} // namespace qt
#endif // QT_CONSTANTS_HPP